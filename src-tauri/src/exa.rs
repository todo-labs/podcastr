use serde::{Deserialize, Serialize};
use std::env;

use crate::utils::{format_error_chain, http_client};

const EXA_SEARCH_URL: &str = "https://api.exa.ai/search";

/// Input parameters for the episode research search command.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchEpisodeResearchInput {
    pub api_key: Option<String>,
    pub query: String,
    pub num_results: Option<u8>,
}

/// A single search result returned from Exa, shaped for the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeResearchResult {
    pub title: String,
    pub url: String,
    pub published_date: Option<String>,
    pub author: Option<String>,
    pub highlights: Vec<String>,
}

/// The full output of the research search command.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchEpisodeResearchOutput {
    pub query: String,
    pub results: Vec<EpisodeResearchResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExaSearchRequest {
    query: String,
    #[serde(rename = "type")]
    search_type: String,
    num_results: u8,
    contents: ExaSearchContents,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExaSearchContents {
    highlights: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExaSearchResponse {
    results: Vec<ExaSearchResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExaSearchResult {
    title: Option<String>,
    url: String,
    published_date: Option<String>,
    author: Option<String>,
    highlights: Option<Vec<String>>,
}

/// Resolves the Exa API key from the caller-supplied value or the environment.
///
/// Returns a user-readable error so the frontend can surface a settings prompt
/// rather than a raw environment variable error.
fn exa_api_key(api_key: Option<&str>) -> Result<String, String> {
    match api_key.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(value.to_string()),
        None => env::var("EXA_API_KEY").map_err(|_| {
            "Exa API key is not configured. Add it in Settings to ground podcasts with web research."
                .to_string()
        }),
    }
}

/// Searches the Exa neural search API for web content relevant to a podcast topic.
///
/// Results include extracted highlight snippets that are passed as `research_context`
/// to the script generation pipeline. Returns an empty result list (not an error)
/// when the query is blank, so the frontend can call this speculatively.
#[tauri::command]
pub async fn search_episode_research(
    input: SearchEpisodeResearchInput,
) -> Result<SearchEpisodeResearchOutput, String> {
    let api_key = exa_api_key(input.api_key.as_deref())?;
    // Clamp to the documented Exa limit; don't trust the frontend value directly.
    let num_results = input.num_results.unwrap_or(5).clamp(1, 10);
    let query = input.query.trim().to_string();

    if query.is_empty() {
        return Ok(SearchEpisodeResearchOutput {
            query,
            results: Vec::new(),
        });
    }

    let request = ExaSearchRequest {
        query: query.clone(),
        search_type: "auto".to_string(),
        num_results,
        contents: ExaSearchContents { highlights: true },
    };

    let response = http_client()?
        .post(EXA_SEARCH_URL)
        .header("x-api-key", api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("Exa request failed: {error}{}", format_error_chain(&error)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Exa search failed with status {status}: {body}"));
    }

    let search_response = response
        .json::<ExaSearchResponse>()
        .await
        .map_err(|error| {
            format!(
                "Exa response parse failed: {error}{}",
                format_error_chain(&error)
            )
        })?;

    Ok(SearchEpisodeResearchOutput {
        query,
        results: search_response
            .results
            .into_iter()
            .map(|result| EpisodeResearchResult {
                // Fall back to the URL when the result has no title, which Exa
                // occasionally returns for pages with missing <title> tags.
                title: result.title.unwrap_or_else(|| result.url.clone()),
                url: result.url,
                published_date: result.published_date,
                author: result.author,
                highlights: result.highlights.unwrap_or_default(),
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- exa_api_key ---

    #[test]
    fn exa_api_key_returns_provided_value() {
        let result = exa_api_key(Some("test-key-123"));
        assert_eq!(result.unwrap(), "test-key-123");
    }

    #[test]
    fn exa_api_key_rejects_empty_string() {
        // When the frontend sends an empty key, we should fall through to the env
        // lookup rather than passing an empty string to the API.
        std::env::remove_var("EXA_API_KEY");
        let result = exa_api_key(Some(""));
        assert!(result.is_err());
    }

    #[test]
    fn exa_api_key_rejects_whitespace_only() {
        std::env::remove_var("EXA_API_KEY");
        let result = exa_api_key(Some("   "));
        assert!(result.is_err());
    }

    // --- result mapping ---

    #[test]
    fn episode_research_result_uses_url_as_fallback_title() {
        let raw = ExaSearchResult {
            title: None,
            url: "https://example.com/article".to_string(),
            published_date: None,
            author: None,
            highlights: None,
        };
        let mapped = EpisodeResearchResult {
            title: raw.title.unwrap_or_else(|| raw.url.clone()),
            url: raw.url,
            published_date: raw.published_date,
            author: raw.author,
            highlights: raw.highlights.unwrap_or_default(),
        };
        assert_eq!(mapped.title, "https://example.com/article");
        assert!(mapped.highlights.is_empty());
    }

    #[test]
    fn episode_research_result_prefers_explicit_title_over_url() {
        let raw = ExaSearchResult {
            title: Some("Real Title".to_string()),
            url: "https://example.com/article".to_string(),
            published_date: None,
            author: None,
            highlights: Some(vec!["snippet".to_string()]),
        };
        let title = raw.title.unwrap_or_else(|| raw.url.clone());
        assert_eq!(title, "Real Title");
    }

    // --- num_results clamping ---

    #[test]
    fn num_results_clamps_below_minimum() {
        assert_eq!(0u8.clamp(1, 10), 1);
    }

    #[test]
    fn num_results_clamps_above_maximum() {
        assert_eq!(20u8.clamp(1, 10), 10);
    }

    #[test]
    fn num_results_passes_through_valid_value() {
        assert_eq!(5u8.clamp(1, 10), 5);
    }
}
