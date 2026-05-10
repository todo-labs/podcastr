use async_openai::{
    config::OpenAIConfig,
    types::{
        audio::{CreateSpeechRequestArgs, SpeechModel, SpeechResponseFormat, Voice},
        responses::CreateResponseArgs,
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
        Some("professional") => "clear, authoritative, and polished",
        Some("energetic") => "bright, fast-paced, and dynamic",
        Some("calm") => "steady, warm, and soothing",
        _ => "natural, conversational, and easy to follow",
    }
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

fn build_brief_prompt(input: &GeneratePodcastScriptInput) -> String {
    let themes = script_themes(input);
    let duration = input.duration_minutes.unwrap_or(4);
    let voice_style = voice_style_description(input.voice_type.as_deref());
    let research_context = research_section(input);

    format!(
        "You are a senior podcast producer. Build a compact episode brief for a {duration}-minute single-host episode.\n\nAudience interests: {themes}\nDesired voice: {voice_style}.{research_context}\n\nWrite a brief with these sections:\n- angle: the specific point of view, tension, or question the episode is built around\n- audience promise: what the listener will understand by the end\n- must-use details: concrete facts, dated details, named examples, and source URLs worth using\n- avoid: generic claims, stale facts, essay phrasing, and anything unsupported by the research notes\n- sound: how the host should feel on mic\n\nKeep it under 600 words. Do not write the script yet.",
        themes = themes,
        voice_style = voice_style,
        duration = duration,
        research_context = research_context
    )
}

fn build_outline_prompt(input: &GeneratePodcastScriptInput, brief: &str) -> String {
    let duration = input.duration_minutes.unwrap_or(4);

    format!(
        "Turn this producer brief into a spoken podcast beat outline for a {duration}-minute single-host episode.\n\nProducer brief:\n{brief}\n\nReturn a tight outline with:\n- cold open beat\n- setup beat\n- 3 to 5 body beats, each with a concrete detail or example\n- transition notes between beats\n- closing beat that lands without sounding like a school essay\n\nDo not write full paragraphs yet. Make the structure sound like audio, not an article."
    )
}

fn build_draft_prompt(input: &GeneratePodcastScriptInput, brief: &str, outline: &str) -> String {
    let duration = input.duration_minutes.unwrap_or(4);
    let voice_style = voice_style_description(input.voice_type.as_deref());

    format!(
        "Write the first full script draft from this brief and outline.\n\nTarget length: about {duration} minutes spoken aloud.\nVoice style: {voice_style}.\n\nProducer brief:\n{brief}\n\nBeat outline:\n{outline}\n\nReturn only a JSON object with exactly these keys:\n- title: concise episode title\n- summary: one sentence episode summary\n- hook: the opening hook, written as spoken audio\n- script: the full spoken script\n- voice_instructions: short TTS direction for the narrator\n- estimated_duration_minutes: integer estimate\n\nWriting rules:\n- sound like a real host talking, not an essay being read\n- vary sentence length and rhythm\n- use contractions naturally\n- include concrete details from the brief where useful\n- do not cite URLs aloud unless it is editorially natural\n- avoid \"In today's episode\", \"we'll explore\", \"delve\", \"landscape\", \"fascinating\", and generic wrap-up language\n- keep the script under 3200 characters"
    )
}

fn build_editor_prompt(draft_json: &str) -> String {
    format!(
        "You are an audio editor cleaning up an AI-generated podcast script so it sounds human, specific, and ready for TTS.\n\nDraft JSON:\n{draft_json}\n\nReturn only a JSON object with exactly the same keys:\n- title\n- summary\n- hook\n- script\n- voice_instructions\n- estimated_duration_minutes\n\nEditing rules:\n- preserve factual claims from the draft; do not add new facts\n- remove AI cadence, generic throat-clearing, and essay transitions\n- make the first 20 seconds sharper\n- make every paragraph speakable in one breath or two\n- add light conversational rhythm, but no stage directions inside the script\n- keep the script under 3200 characters\n- keep estimated_duration_minutes as an integer"
    )
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
    "Create a polished podcast episode cover for '{title}'. The episode explores {summary}. Visual style: editorial, cinematic, modern, high contrast, rich detail, no text, no logos, no watermarks. Themes: {themes}. Compose it like a professional podcast thumbnail with a strong central subject and clear visual hierarchy.",
    title = input.title,
    summary = input.summary,
    themes = themes
  )
}

fn build_client(api_key: Option<String>) -> Result<Client<OpenAIConfig>, String> {
    let config = OpenAIConfig::new().with_api_key(openai_api_key(api_key)?);
    Ok(Client::build(http_client()?, config))
}

async fn create_response_text(
    client: &Client<OpenAIConfig>,
    model: &str,
    prompt: String,
    max_output_tokens: u32,
) -> Result<String, String> {
    let request = CreateResponseArgs::default()
        .model(model)
        .input(prompt)
        .max_output_tokens(max_output_tokens)
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
    let parsed: Value = serde_json::from_str(json_text).map_err(|error| error.to_string())?;
    let title = parsed
        .get("title")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing title in OpenAI script response".to_string())?;
    let summary = parsed
        .get("summary")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing summary in OpenAI script response".to_string())?;
    let hook = parsed
        .get("hook")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing hook in OpenAI script response".to_string())?;
    let script = parsed
        .get("script")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing script in OpenAI script response".to_string())?;
    let voice_instructions = parsed
        .get("voice_instructions")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing voice_instructions in OpenAI script response".to_string())?;
    let estimated_duration_minutes = parsed
        .get("estimated_duration_minutes")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            "Missing estimated_duration_minutes in OpenAI script response".to_string()
        })?;

    Ok(GeneratePodcastScriptOutput {
        title: title.to_string(),
        summary: summary.to_string(),
        hook: hook.to_string(),
        script: script.to_string(),
        voice_instructions: voice_instructions.to_string(),
        estimated_duration_minutes: estimated_duration_minutes as u32,
    })
}

#[tauri::command]
pub async fn generate_podcast_script(
    input: GeneratePodcastScriptInput,
) -> Result<GeneratePodcastScriptOutput, String> {
    let api_key = input.api_key.clone();
    let client = build_client(api_key)?;
    let script_model = normalize_script_model(input.script_model.as_deref());

    let brief = create_response_text(
        &client,
        &script_model,
        build_brief_prompt(&input),
        1200u32,
    )
    .await?;

    let outline = create_response_text(
        &client,
        &script_model,
        build_outline_prompt(&input, &brief),
        1200u32,
    )
    .await?;

    let draft_json = create_response_text(
        &client,
        &script_model,
        build_draft_prompt(&input, &brief, &outline),
        2200u32,
    )
    .await?;

    let edited_json = create_response_text(
        &client,
        &script_model,
        build_editor_prompt(&draft_json),
        2200u32,
    )
    .await?;

    extract_json_object(&edited_json)
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
