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
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SCRIPT_MODEL: &str = "gpt-5-nano";
const IMAGE_MODEL: &str = "gpt-image-1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePodcastScriptInput {
    pub api_key: Option<String>,
    pub themes: Vec<String>,
    pub voice_type: Option<String>,
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

fn voice_style_description(voice_type: Option<&str>) -> &'static str {
    match voice_type {
        Some("professional") => "clear, authoritative, and polished",
        Some("energetic") => "bright, fast-paced, and dynamic",
        Some("calm") => "steady, warm, and soothing",
        _ => "natural, conversational, and easy to follow",
    }
}

fn build_script_prompt(input: &GeneratePodcastScriptInput) -> String {
    let themes = if input.themes.is_empty() {
        "technology, culture, and practical innovation".to_string()
    } else {
        input.themes.join(", ")
    };

    let duration = input.duration_minutes.unwrap_or(4);
    let voice_style = voice_style_description(input.voice_type.as_deref());
    let research_context = input
        .research_context
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| {
            format!(
                "\n\nUse this recent web research as grounding material. Prefer concrete, dated details. Do not invent facts beyond these notes. If a detail is uncertain, omit it.\n\n{value}"
            )
        })
        .unwrap_or_default();

    format!(
        "Create a podcast episode package for listeners interested in {themes}. The episode should feel {voice_style} and run about {duration} minutes when spoken aloud.{research_context}\n\nReturn a JSON object with exactly these keys:\n- title: a concise episode title\n- summary: one sentence episode summary\n- hook: a short opening hook\n- script: the full spoken script\n- voice_instructions: short instructions for the narrator voice\n- estimated_duration_minutes: an integer estimate\n\nKeep the script concise and under 3200 characters so it fits the speech synthesis request in one pass. Write a strong, production-ready script that sounds like a real podcast host speaking to an audience. Avoid generic AI cadence, thesis-essay structure, and phrases like \"in today's episode\" unless they sound natural in context.",
        themes = themes,
        voice_style = voice_style,
        duration = duration,
        research_context = research_context
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
    Ok(Client::with_config(config))
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
    let parsed: Value = serde_json::from_str(text).map_err(|error| error.to_string())?;
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
    let prompt = build_script_prompt(&input);

    let request = CreateResponseArgs::default()
        .model(SCRIPT_MODEL)
        .input(prompt)
        .max_output_tokens(1600u32)
        .temperature(0.7)
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .responses()
        .create(request)
        .await
        .map_err(|error| error.to_string())?;

    let output_text = response
        .output_text()
        .ok_or_else(|| "OpenAI response did not include any text output".to_string())?;

    extract_json_object(&output_text)
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
        .map_err(|error| error.to_string())?;

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
        .map_err(|error| error.to_string())?;

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
