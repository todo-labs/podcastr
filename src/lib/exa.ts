import { invoke } from "@tauri-apps/api/core"
import { getAppSettings } from "@/lib/persistence"

export type EpisodeResearchResult = {
  title: string
  url: string
  publishedDate?: string
  author?: string
  highlights: string[]
}

export type SearchEpisodeResearchOutput = {
  query: string
  results: EpisodeResearchResult[]
}

export async function searchEpisodeResearch(query: string) {
  const settings = await getAppSettings()
  const apiKey = settings.exaApiKey.trim()

  if (!apiKey || !query.trim()) {
    return {
      query,
      results: [],
    } satisfies SearchEpisodeResearchOutput
  }

  return invoke<SearchEpisodeResearchOutput>("search_episode_research", {
    input: {
      apiKey,
      query,
      numResults: 5,
    },
  })
}

export function formatResearchContext(research: SearchEpisodeResearchOutput) {
  if (research.results.length === 0) {
    return ""
  }

  return research.results
    .map((result, index) => {
      const date = result.publishedDate ? ` (${result.publishedDate})` : ""
      const author = result.author ? ` by ${result.author}` : ""
      const highlights = result.highlights.length > 0
        ? result.highlights.map((highlight) => `  - ${highlight}`).join("\n")
        : "  - No excerpt returned."

      return `[${index + 1}] ${result.title}${date}${author}\nURL: ${result.url}\n${highlights}`
    })
    .join("\n\n")
}
