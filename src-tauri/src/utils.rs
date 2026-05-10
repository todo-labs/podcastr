use async_openai::error::OpenAIError;

#[derive(Debug, thiserror::Error)]
pub(crate) enum AppError {
    #[error("{message}")]
    Config { message: &'static str },
    #[error("HTTP client setup failed: {0}")]
    HttpClient(#[source] reqwest::Error),
    #[error("{service} request failed: {source}")]
    HttpRequest {
        service: &'static str,
        #[source]
        source: reqwest::Error,
    },
    #[error("{service} response parse failed: {source}")]
    HttpResponseParse {
        service: &'static str,
        #[source]
        source: reqwest::Error,
    },
    #[error("{service} API failed with status {status}: {body}")]
    ApiStatus {
        service: &'static str,
        status: reqwest::StatusCode,
        body: String,
    },
    #[error("OpenAI {operation} failed: {source}")]
    OpenAi {
        operation: &'static str,
        #[source]
        source: OpenAIError,
    },
    #[error("File {action} failed: {source}")]
    File {
        action: &'static str,
        #[source]
        source: std::io::Error,
    },
    #[error("Tauri {action} failed: {source}")]
    Tauri {
        action: &'static str,
        #[source]
        source: tauri::Error,
    },
    #[error("JSON parse failed: {0}")]
    JsonParse(#[source] serde_json::Error),
    #[error("base64 decode failed: {0}")]
    Base64Decode(#[source] base64::DecodeError),
    #[error("{0}")]
    MissingResponse(&'static str),
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        format!("{error}{}", format_error_chain(&error))
    }
}

/// Builds an HTTP client with proxy disabled.
///
/// Proxy is explicitly disabled to prevent interference from system-level proxy
/// settings that may be present on end-user machines running the desktop app.
/// Each Tauri command constructs its own client rather than sharing one, since
/// Tauri commands can run concurrently and `reqwest::Client` is internally
/// connection-pooled — the per-call overhead is construction only.
pub(crate) fn http_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(AppError::HttpClient)
}

/// Formats the full error source chain into a multi-line string.
///
/// Walks [`std::error::Error::source`] recursively to surface root causes
/// that would otherwise be hidden behind the top-level error display.
/// Appended to user-facing error messages so the frontend can show full context.
pub(crate) fn format_error_chain(error: &dyn std::error::Error) -> String {
    let mut details = String::new();
    let mut current = error.source();

    while let Some(source) = current {
        details.push_str("\n- ");
        details.push_str(&source.to_string());
        current = source.source();
    }

    details
}
