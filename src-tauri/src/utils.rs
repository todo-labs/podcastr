/// Builds an HTTP client with proxy disabled.
///
/// Proxy is explicitly disabled to prevent interference from system-level proxy
/// settings that may be present on end-user machines running the desktop app.
/// Each Tauri command constructs its own client rather than sharing one, since
/// Tauri commands can run concurrently and `reqwest::Client` is internally
/// connection-pooled — the per-call overhead is construction only.
pub(crate) fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())
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
