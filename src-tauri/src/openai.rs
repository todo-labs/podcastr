use async_openai::{
    config::OpenAIConfig,
    types::{
        audio::{CreateSpeechRequestArgs, SpeechModel, SpeechResponseFormat, Voice},
        responses::{
            CreateResponseArgs, ReasoningArgs, ReasoningEffort, Reasoning,
            ResponseFormatJsonSchema, ResponseTextParam,
        },
    },
    Client,
};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env, fs,
    error::Error as StdError,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DEFAULT_SCRIPT_MODEL: &str = "gpt-5.5";
const IMAGE_MODEL: &str = "gpt-image-1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePodcastScriptInput {
    pub api_key: Option<String>,
    pub themes: Vec<String>,
    pub voice_type: Option<String>,
    pub script_model: Option<String>,
    pub duration_minutes: Option<u32>,
    pub research_context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePodcastScriptOutput {
    pub title: String,
    pub summary: String,
    pub hook: String,
    pub intro: String,
    pub conclusion: String,
    pub script: String,
    pub voice_instructions: String,
    pub estimated_duration_minutes: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePodcastVoiceInput {
    pub api_key: Option<String>,
    pub text: String,
    pub voice: Option<String>,
    pub instructions: Option<String>,
    pub response_format: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePodcastVoiceOutput {
    pub audio_path: String,
    pub mime_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateEpisodeGraphicInput {
    pub api_key: Option<String>,
    pub title: String,
    pub summary: String,
    pub themes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateEpisodeGraphicOutput {
    pub image_path: String,
    pub mime_type: String,
}

fn openai_api_key(api_key: Option<String>) -> Result<String, String> {
    match api_key.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(value),
        None => env::var("OPENAI_API_KEY").map_err(|_| {
            "OpenAI API key is not configured. Add it in Settings before generating podcasts."
                .to_string()
        }),
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())
}

fn format_error_chain(error: &dyn StdError) -> String {
    let mut details = String::new();
    let mut current = error.source();

    while let Some(source) = current {
        details.push_str("\n- ");
        details.push_str(&source.to_string());
        current = source.source();
    }

    details
}

fn voice_style_description(voice_type: Option<&str>) -> &'static str {
    match voice_type {
        Some("professional") => {
            "authoritative but human — the host speaks like a senior journalist or analyst who has done their homework. \
             Sentences are crisp but not clipped. Opinions are stated plainly. \
             No hedging, no throat-clearing. The host earns credibility through specificity, not formality."
        }
        Some("energetic") => {
            "fast-thinking and direct — the host speaks like someone who gets genuinely excited about ideas \
             and wants the listener to feel that pull. Short punchy sentences follow longer explanations. \
             The energy comes from genuine curiosity, not performance. \
             The host moves fast but never skips the payoff."
        }
        Some("calm") => {
            "unhurried and thoughtful — the host talks like a trusted friend who has had time to think something through \
             and wants to share it carefully. Longer sentences, natural pauses implied by the text. \
             The host admits uncertainty when it exists. The listener feels like they are being talked to, not at."
        }
        _ => {
            "conversational and grounded — the host sounds like a smart person explaining something interesting \
             to someone they respect. Not a lecturer, not a hype man. Just someone who found something worth sharing \
             and is telling you about it the way you would over a long lunch."
        }
    }
}

fn ideal_episode_duration_minutes(input: &GeneratePodcastScriptInput) -> u32 {
    let theme_bonus = input.themes.len().saturating_sub(1).min(3) as u32;
    let research_context = input.research_context.as_deref().unwrap_or_default();
    let research_depth = if research_context.trim().is_empty() {
        0
    } else {
        let line_count = research_context.lines().filter(|line| !line.trim().is_empty()).count() as u32;
        match line_count {
            0..=2 => 1,
            3..=5 => 2,
            _ => 3,
        }
    };

    (15 + theme_bonus + research_depth).clamp(15, 24)
}

fn target_word_count(minutes: u32) -> u32 {
    minutes.saturating_mul(140)
}

fn normalize_script_model(model: Option<&str>) -> String {
    match model.filter(|value| !value.trim().is_empty()) {
        Some("gpt-5.5") => "gpt-5.5".to_string(),
        Some("gpt-5.4") => "gpt-5.4".to_string(),
        Some("gpt-5") => "gpt-5".to_string(),
        Some("gpt-5-mini") => "gpt-5-mini".to_string(),
        Some("gpt-5-nano") => "gpt-5-nano".to_string(),
        Some(other) => other.to_string(),
        None => DEFAULT_SCRIPT_MODEL.to_string(),
    }
}

fn script_themes(input: &GeneratePodcastScriptInput) -> String {
    if input.themes.is_empty() {
        "technology, culture, and practical innovation".to_string()
    } else {
        input.themes.join(", ")
    }
}

fn research_section(input: &GeneratePodcastScriptInput) -> String {
    input
        .research_context
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| {
            format!(
                "\n\nUse this recent web research as grounding material. Prefer concrete, dated details. Do not invent facts beyond these notes. If a detail is uncertain, omit it.\n\n{value}"
            )
        })
        .unwrap_or_default()
}

fn build_brief_prompt(input: &GeneratePodcastScriptInput, target_duration: u32, word_count: u32) -> String {
    let themes = script_themes(input);
    let voice_style = voice_style_description(input.voice_type.as_deref());
    let research_context = research_section(input);

    format!(
        "You are a researcher who has just finished a deep read on a set of topics for a podcast host you work closely with. \
         Your job is not to plan a podcast episode — your job is to brief your boss on what you found, \
         what surprised you, what the real story is, and what they should say about it.\n\n\
         The host's audience cares about: {themes}\n\
         The host's on-mic register: {voice_style}\n\
         Episode length: {target_duration} minutes spoken aloud (roughly {word_count} words).\
         {research_context}\n\n\
         Write a research brief with these sections:\n\n\
         ANGLE\n\
         What is the actual story here? Not the topic — the story. What tension, reversal, or question makes this worth \
         a full episode? What would make a smart listener sit up? Give one sharp sentence, then explain it in two or three more.\n\n\
         THE TURN\n\
         What is the single fact, detail, or idea in this material that reframes everything else? \
         This is the thing the host builds toward. It should feel like a reveal, not a conclusion.\n\n\
         WHAT SURPRISED ME\n\
         What did you not expect to find? What assumption did the research challenge? \
         This is the part where the host can say \"I thought X, but it turns out...\" — which is the most human thing a host can do.\n\n\
         AUDIENCE PROMISE\n\
         What will the listener understand by the end that they did not understand at the start? \
         Not what they will \"learn\" — what will land differently for them after they hear this.\n\n\
         OPENING MOVE\n\
         How should the episode start? Not an intro — the first thing the host says. It should drop the listener into something: \
         a scene, a number, a quote, a question, a claim. Not a welcome, not a setup. The thing itself.\n\n\
         CONCRETE MATERIAL\n\
         List the specific facts, named people or companies, dates, numbers, and examples worth using. \
         Only include things you can support from the research. Mark anything uncertain with [uncertain].\n\n\
         WHAT TO AVOID\n\
         What would make this episode feel generic? What angles are overdone, what facts are stale, \
         what would a lazy version of this episode say?\n\n\
         HOW IT SHOULD FEEL\n\
         Describe the emotional texture of the episode in two or three sentences. \
         Not the delivery — the feeling. Should the listener feel unsettled? Energized? Quietly impressed? Why?\n\n\
         Do not write the script. Do not write in podcast language. Write like you are briefing your boss before a recording session.",
        themes = themes,
        voice_style = voice_style,
        target_duration = target_duration,
        word_count = word_count,
        research_context = research_context
    )
}

fn build_outline_prompt(brief: &str, target_duration: u32) -> String {

    format!(
        "You have a research brief for a {target_duration}-minute single-host podcast episode. \
         Turn it into a spoken audio outline — not a content plan, but a map of how the episode actually moves.\n\n\
         Research brief:\n{brief}\n\n\
         Build the outline with these beats. For each beat, write: what the host says or does, and how it feels.\n\n\
         COLD OPEN (30-60 seconds)\n\
         The first thing the host says. No welcome, no setup. Drop the listener into something specific — \
         a scene, a number, a claim, a question. The listener should be three sentences in before they know \
         what the episode is about. That uncertainty should feel good, not confusing.\n\n\
         ENTRY (1-2 minutes)\n\
         The host earns the listener's attention by saying something unexpected or specific. \
         This is not an intro. It does not explain what is coming. It starts making the case for why this matters \
         by showing rather than telling. By the end of this beat, the listener should feel oriented but still curious.\n\n\
         BODY BEATS (5 to 8 beats for the main content)\n\
         Each beat must have: a concrete detail or named example, a turn or complication (what makes this interesting, \
         not just informative), and a note on how it connects to what comes next — not as a spoken transition, \
         but as a logical or emotional thread. \
         At least one beat should include the host's own reasoning or take. \
         At least one beat should contain a moment of admitted uncertainty or speculation, clearly flagged. \
         One beat should be THE TURN from the brief — the reframe that makes everything else click.\n\n\
         LANDING (2-3 minutes)\n\
         The host does not summarize. They arrive somewhere. The final thought should be the one thing \
         the listener carries out. It should feel earned, not tacked on. \
         It can be a question, a statement, or a small revelation — but it should not recap what just happened.\n\n\
         OUTRO (30-45 seconds)\n\
         Short. Human. The host sounds like themselves, not like a sign-off template. \
         No calls to action unless they feel completely natural. No \"thanks for listening\".\n\n\
         Do not write full sentences yet. Write enough per beat that the script writer knows exactly what to say \
         and how it should feel. Note any places where the host might pause, repeat themselves, \
         or take a beat to think — those are moments that make audio feel real.",
        brief = brief,
        target_duration = target_duration
    )
}

fn build_draft_prompt(input: &GeneratePodcastScriptInput, brief: &str, outline: &str, target_duration: u32, word_count: u32) -> String {
    let voice_style = voice_style_description(input.voice_type.as_deref());

    format!(
        "Write a full podcast script from this brief and outline. \
         Target: {target_duration} minutes spoken aloud, roughly {word_count} words.\n\n\
         HOST REGISTER: {voice_style}\n\n\
         Research brief:\n{brief}\n\n\
         Beat outline:\n{outline}\n\n\
         HOW TO WRITE THIS\n\n\
         Think of this host as someone who had a good researcher brief them, and is now telling their audience \
         about what they found — the way a smart person talks to a friend they respect, not the way a lecturer \
         addresses a class. The host has done their homework. They have opinions. They find this genuinely interesting. \
         None of that should be performed — it should come through in the specifics they choose and the way they talk about them.\n\n\
         The script should sound like it was written once, fast, by someone who knew what they wanted to say. \
         Not polished. Not constructed. Not outlined with bullet points in their head. \
         The host moves through ideas the way a person does — with momentum, occasional self-correction, \
         and a clear sense of where they are going even when they take a detour.\n\n\
         THINGS THAT MAKE IT SOUND REAL:\n\
         - The host states opinions plainly. Not \"some would argue\" — \"I think\". Not \"it's interesting that\" — \"what gets me is\".\n\
         - Sentences vary wildly in length. One sentence is four words. The next is twenty-five. That rhythm is the voice.\n\
         - The host uses contractions everywhere. Always. No exceptions.\n\
         - Occasionally the host pauses mid-thought and lands differently than you expected. That's a real person thinking.\n\
         - Concrete details are stated without preamble. Not \"here's an interesting fact\" — just the fact.\n\
         - When the host is speculating, they say so: \"my read on this is\", \"I don't know for sure, but\", \"this part is less certain\".\n\
         - The opening does not explain what the episode is about. It starts in the middle of something.\n\
         - The ending does not summarize. It arrives somewhere. One final thought that feels like it was earned.\n\n\
         THINGS THAT KILL THE VOICE (never do these):\n\
         - \"In today's episode\", \"Today we're going to\", \"We'll explore\", \"Let's dive in\", \"Let's unpack\"\n\
         - \"Fascinating\", \"Delve\", \"Landscape\", \"Ecosystem\", \"Nuanced\", \"Groundbreaking\", \"Game-changing\"\n\
         - \"It's worth noting\", \"It's important to remember\", \"One thing is clear\"\n\
         - \"That's a great question\" or any self-answering setup\n\
         - Numbered or lettered lists spoken aloud: \"First... Second... Third\"\n\
         - Announced transitions: \"Now let's turn to\", \"Moving on\", \"Next up\"\n\
         - Summary at the end: \"So, to recap\", \"In conclusion\", \"To summarize\", \"We've covered a lot today\"\n\
         - Calls to action that feel bolted on: \"Subscribe\", \"Leave a review\", \"Follow us\"\n\
         - Any sentence that could appear in a blog post without changing a single word\n\n\
         STRUCTURE:\n\
         Follow the outline beats but do not announce them. The listener should not be able to identify \
         where one section ends and another begins. The script flows. Transitions are earned by logic or feeling, \
         not announced by language.\n\n\
         Return only a JSON object with exactly these keys:\n\
         - title: a concise, specific episode title — not a generic label, something a real show would use\n\
         - summary: one sentence, written like a show note, not a pitch\n\
         - hook: the cold open, written exactly as it will be spoken\n\
         - intro: the entry beat that follows the cold open\n\
         - conclusion: the landing and outro, written as spoken audio\n\
         - script: the complete spoken script from first word to last — this is what gets read aloud, in full\n\
         - voice_instructions: two or three sentences of direction for the TTS narrator on pacing, tone, and register\n\
         - estimated_duration_minutes: integer\n\n\
         The script field must be the full episode. Do not compress it. Do not write a synopsis. \
         Write every word the host says.",
        brief = brief,
        outline = outline,
        voice_style = voice_style,
        target_duration = target_duration,
        word_count = word_count
    )
}

fn build_editor_prompt(draft_json: &str, target_duration: u32, word_count: u32) -> String {
    format!(
        "You are a script editor who specializes in making AI-generated podcast scripts sound like they were \
         written by a real human host. You are not rewriting this — you are editing it. \
         You know what AI sounds like, and you are going to remove every trace of it.\n\n\
         Target: {target_duration} minutes spoken aloud, roughly {word_count} words.\n\n\
         Draft JSON:\n{draft_json}\n\n\
         Return only a JSON object with exactly the same keys:\n\
         - title / summary / hook / intro / conclusion / script / voice_instructions / estimated_duration_minutes\n\n\
         YOUR JOB:\n\n\
         1. HUNT AND KILL AI TELLS\n\
         Go sentence by sentence through the script. Remove or rewrite any sentence that:\n\
         - starts with \"In today's episode\", \"Today we\", \"Welcome to\", \"Thanks for joining\"\n\
         - uses: fascinating, delve, landscape, ecosystem, nuanced, groundbreaking, game-changing, \
           multifaceted, pivotal, seamlessly, importantly, notably, crucially, ultimately, \
           it's worth noting, it's important to remember, one thing is clear, needless to say\n\
         - announces a transition: \"now let's turn to\", \"moving on\", \"next up\", \"let's shift\"\n\
         - summarizes at the end: \"so to recap\", \"in conclusion\", \"to summarize\", \"we've covered\"\n\
         - reads like an essay sentence: subject, predicate, object, period, repeat — flat cadence, no variation\n\
         - uses passive constructions to avoid a point of view: \"it has been argued\", \"some might say\", \
           \"there are those who believe\"\n\
         - performs enthusiasm instead of feeling it: \"this is really exciting\", \"I love this topic\"\n\n\
         2. CHECK THE OPENING\n\
         The first 30 seconds must not explain what the episode is about. \
         If it does, cut it and start at the first moment of substance. \
         The cold open should drop the listener into something specific — a number, a scene, a claim — \
         before they know what the episode is. Fix it if it does not do this.\n\n\
         3. CHECK THE ENDING\n\
         The conclusion must not summarize the episode. It must arrive somewhere — one final thought \
         that feels earned. If it recaps, cut the recap and find the real final thought buried underneath it.\n\n\
         4. CHECK FOR A POINT OF VIEW\n\
         The host must have opinions. Find at least two places where the host states a position plainly — \
         not \"it could be argued\" but \"I think\" or \"my read on this is\". \
         If they do not exist, add them in places where the research supports a take.\n\n\
         5. FIX FLAT RHYTHM\n\
         Find any passage of three or more sentences that are all roughly the same length. Break them up. \
         Add a very short sentence. Let a longer one breathe. The rhythm of a real voice is not metronomic.\n\n\
         6. PRESERVE EVERYTHING FACTUAL\n\
         Do not add new facts. Do not remove specific details, named examples, or numbers from the draft. \
         Your job is to make the voice sound human, not to change what the host knows.\n\n\
         7. KEEP IT SPEAKABLE\n\
         Every sentence must be something a person could say naturally. \
         Read it aloud in your head. If it requires a breath in a strange place, rewrite it.\n\n\
         estimated_duration_minutes must remain an integer.",
        draft_json = draft_json,
        target_duration = target_duration,
        word_count = word_count
    )
}

fn script_response_format() -> ResponseTextParam {
    ResponseFormatJsonSchema {
        description: Some(
            "Structured output for a generated podcast episode script and narration guidance."
                .to_string(),
        ),
        name: "podcastr_podcast_script".to_string(),
        schema: Some(serde_json::json!({
            "type": "object",
            "additionalProperties": false,
            "required": [
                "title",
                "summary",
                "hook",
                "intro",
                "conclusion",
                "script",
                "voice_instructions",
                "estimated_duration_minutes"
            ],
            "properties": {
                "title": { "type": "string" },
                "summary": { "type": "string" },
                "hook": { "type": "string" },
                "intro": { "type": "string" },
                "conclusion": { "type": "string" },
                "script": { "type": "string" },
                "voice_instructions": { "type": "string" },
                "estimated_duration_minutes": { "type": "integer", "minimum": 1 }
            }
        })),
        strict: Some(true),
    }
    .into()
}

fn normalize_voice(voice: Option<String>) -> Voice {
    match voice.as_deref() {
        Some("ash") => Voice::Ash,
        Some("ballad") => Voice::Ballad,
        Some("coral") => Voice::Coral,
        Some("echo") => Voice::Echo,
        Some("fable") => Voice::Fable,
        Some("onyx") => Voice::Onyx,
        Some("nova") => Voice::Nova,
        Some("sage") => Voice::Sage,
        Some("shimmer") => Voice::Shimmer,
        Some("verse") => Voice::Verse,
        Some("marin") => Voice::Marin,
        Some("cedar") => Voice::Cedar,
        _ => Voice::Alloy,
    }
}

fn mime_type_for_format(response_format: &str) -> &'static str {
    match response_format {
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "opus" => "audio/opus",
        "pcm" => "audio/pcm",
        _ => "audio/mpeg",
    }
}

fn image_prompt(input: &GenerateEpisodeGraphicInput) -> String {
    let themes = if input.themes.is_empty() {
        "technology and culture".to_string()
    } else {
        input.themes.join(", ")
    };

    format!(
        "Create a polished podcast episode cover for '{title}'. The episode explores {summary}. Visual style: consistent Podcastr house style, editorial, cinematic, modern, high contrast, rich detail, no text, no logos, no watermarks. Color palette: deep navy, warm amber, ivory, and restrained teal accents. Composition: centered subject, subtle geometric framing, clear visual hierarchy, premium broadcast magazine feel, recognizable as part of the same content house across episodes. Themes: {themes}.",
        title = input.title,
        summary = input.summary,
        themes = themes
    )
}

fn build_client(api_key: Option<String>) -> Result<Client<OpenAIConfig>, String> {
    let config = OpenAIConfig::new().with_api_key(openai_api_key(api_key)?);
    Ok(Client::build(http_client()?, config))
}

fn reasoning_settings(effort: ReasoningEffort) -> Result<Reasoning, String> {
    ReasoningArgs::default()
        .effort(effort)
        .build()
        .map_err(|error| error.to_string())
}

async fn create_response_text(
    client: &Client<OpenAIConfig>,
    model: &str,
    prompt: String,
    max_output_tokens: u32,
    reasoning_effort: ReasoningEffort,
    structured_output: bool,
) -> Result<String, String> {
    let mut request_builder = CreateResponseArgs::default();
    request_builder
        .model(model)
        .input(prompt)
        .max_output_tokens(max_output_tokens)
        .reasoning(reasoning_settings(reasoning_effort)?);

    if structured_output {
        request_builder.text(script_response_format());
    }

    let request = request_builder
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .responses()
        .create(request)
        .await
        .map_err(|error| format!("OpenAI request failed: {error}{}", format_error_chain(&error)))?;

    response
        .output_text()
        .ok_or_else(|| "OpenAI response did not include any text output".to_string())
}

fn app_media_dir(app: &AppHandle, folder_name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join(folder_name);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn unique_media_file_name(prefix: &str, extension: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{prefix}-{millis}-{}.{}", Uuid::new_v4(), extension)
}

fn extract_json_object(text: &str) -> Result<GeneratePodcastScriptOutput, String> {
    let trimmed = text.trim();
    let json_text = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };
    let json_text = match (json_text.find('{'), json_text.rfind('}')) {
        (Some(start), Some(end)) if start <= end => &json_text[start..=end],
        _ => json_text,
    };
    serde_json::from_str(json_text).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn generate_podcast_script(
    input: GeneratePodcastScriptInput,
) -> Result<GeneratePodcastScriptOutput, String> {
    let api_key = input.api_key.clone();
    let client = build_client(api_key)?;
    let script_model = normalize_script_model(input.script_model.as_deref());
    let target_duration = input
        .duration_minutes
        .unwrap_or_else(|| ideal_episode_duration_minutes(&input));
    let word_count = target_word_count(target_duration);

    let brief = create_response_text(
        &client,
        &script_model,
        build_brief_prompt(&input, target_duration, word_count),
        1600u32,
        ReasoningEffort::Medium,
        false,
    )
    .await?;

    let outline = create_response_text(
        &client,
        &script_model,
        build_outline_prompt(&brief, target_duration),
        1800u32,
        ReasoningEffort::Medium,
        false,
    )
    .await?;

    let draft_json = create_response_text(
        &client,
        &script_model,
        build_draft_prompt(&input, &brief, &outline, target_duration, word_count),
        6000u32,
        ReasoningEffort::High,
        true,
    )
    .await?;

    let edited_json = create_response_text(
        &client,
        &script_model,
        build_editor_prompt(&draft_json, target_duration, word_count),
        6000u32,
        ReasoningEffort::High,
        true,
    )
    .await?;

    let mut output = extract_json_object(&edited_json)?;
    output.estimated_duration_minutes = output.estimated_duration_minutes.max(target_duration);
    Ok(output)
}

#[tauri::command]
pub async fn generate_podcast_voice(
    app: AppHandle,
    input: GeneratePodcastVoiceInput,
) -> Result<GeneratePodcastVoiceOutput, String> {
    let client = build_client(input.api_key)?;
    let response_format = input.response_format.as_deref().unwrap_or("mp3");
    let mut request_builder = CreateSpeechRequestArgs::default();
    request_builder
        .model(SpeechModel::Gpt4oMiniTts)
        .input(input.text)
        .voice(normalize_voice(input.voice))
        .response_format(match response_format {
            "wav" => SpeechResponseFormat::Wav,
            "flac" => SpeechResponseFormat::Flac,
            "aac" => SpeechResponseFormat::Aac,
            "opus" => SpeechResponseFormat::Opus,
            "pcm" => SpeechResponseFormat::Pcm,
            _ => SpeechResponseFormat::Mp3,
        });

    if let Some(instructions) = input.instructions {
        request_builder.instructions(instructions);
    }

    let request = request_builder.build().map_err(|error| error.to_string())?;

    let response = client
        .audio()
        .speech()
        .create(request)
        .await
        .map_err(|error| format!("OpenAI speech request failed: {error}{}", format_error_chain(&error)))?;

    let extension = match response_format {
        "wav" => "wav",
        "flac" => "flac",
        "aac" => "aac",
        "opus" => "opus",
        "pcm" => "pcm",
        _ => "mp3",
    };
    let audio_dir = app_media_dir(&app, "generated-audio")?;
    let audio_path = audio_dir.join(unique_media_file_name("podcastr-episode", extension));
    fs::write(&audio_path, &response.bytes).map_err(|error| error.to_string())?;

    Ok(GeneratePodcastVoiceOutput {
        audio_path: audio_path.to_string_lossy().to_string(),
        mime_type: mime_type_for_format(response_format).to_string(),
    })
}

#[tauri::command]
pub async fn generate_episode_graphic(
    app: AppHandle,
    input: GenerateEpisodeGraphicInput,
) -> Result<GenerateEpisodeGraphicOutput, String> {
    let api_key = input.api_key.clone();
    let client = build_client(api_key)?;
    let request = serde_json::json!({
      "model": IMAGE_MODEL,
      "prompt": image_prompt(&input),
      "quality": "high",
      "size": "1536x1024",
      "n": 1,
    });

    let response: Value = client
        .images()
        .generate_byot(request)
        .await
        .map_err(|error| format!("OpenAI image request failed: {error}{}", format_error_chain(&error)))?;

    let image_base64 = response
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("b64_json"))
        .and_then(Value::as_str)
        .ok_or_else(|| "OpenAI image response did not include base64 image data".to_string())?;

    let image_dir = app_media_dir(&app, "generated-images")?;
    let image_path = image_dir.join(unique_media_file_name("podcastr-cover", "png"));
    let image_bytes = general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|error| error.to_string())?;
    fs::write(&image_path, image_bytes).map_err(|error| error.to_string())?;

    Ok(GenerateEpisodeGraphicOutput {
        image_path: image_path.to_string_lossy().to_string(),
        mime_type: "image/png".to_string(),
    })
}
