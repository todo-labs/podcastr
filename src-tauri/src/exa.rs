use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{env, error::Error as StdError};

const EXA_SEARCH_URL: &str = "https://api.exa.ai/search";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchEpisodeResearchInput {
    pub api_key: Option<String>,
    pub query: String,
    pub num_results: Option<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeResearchResult {
    pub title: String,
    pub url: String,
    pub published_date: Option<String>,
    pub author: Option<String>,
    pub highlights: Vec<String>,
}

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

fn exa_api_key(api_key: Option<String>) -> Result<String, String> {
    match api_key.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(value),
        None => env::var("EXA_API_KEY").map_err(|_| {
            "Exa API key is not configured. Add it in Settings to ground podcasts with web research."
                .to_string()
        }),
    }
}

fn http_client() -> Result<Client, String> {
    Client::builder()
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

#[tauri::command]
pub async fn search_episode_research(
    input: SearchEpisodeResearchInput,
) -> Result<SearchEpisodeResearchOutput, String> {
    let api_key = exa_api_key(input.api_key)?;
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
        .map_err(|error| format!("Exa response parse failed: {error}{}", format_error_chain(&error)))?;

    Ok(SearchEpisodeResearchOutput {
        query,
        results: search_response
            .results
            .into_iter()
            .map(|result| EpisodeResearchResult {
                title: result.title.unwrap_or_else(|| result.url.clone()),
                url: result.url,
                published_date: result.published_date,
                author: result.author,
                highlights: result.highlights.unwrap_or_default(),
            })
            .collect(),
    })
}
