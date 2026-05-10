import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { getAppSettings } from "@/lib/persistence"
import { PODCAST_THEMES } from "@/lib/themes"

export type PodcastScriptInput = {
  apiKey?: string
  themes: string[]
  voiceType?: string
  scriptModel?: string
  durationMinutes?: number
  researchContext?: string
}

export type PodcastScriptOutput = {
  title: string
  summary: string
  hook: string
  script: string
  voiceInstructions: string
  estimatedDurationMinutes: number
}

export type PodcastVoiceInput = {
  apiKey?: string
  text: string
  voice?: string
  instructions?: string
  responseFormat?: "mp3" | "wav" | "flac" | "aac" | "opus" | "pcm"
}

export type PodcastVoiceOutput = {
  audioPath: string
  mimeType: string
}

export type EpisodeGraphicInput = {
  apiKey?: string
  title: string
  summary: string
  themes: string[]
}

export type EpisodeGraphicOutput = {
  imagePath: string
  mimeType: string
}

const OPENAI_VOICE_MAP: Record<string, string> = {
  natural: "alloy",
  professional: "onyx",
  energetic: "verse",
  calm: "sage",
}

export function mapVoiceTypeToOpenAIVoice(voiceType: string) {
  return OPENAI_VOICE_MAP[voiceType] ?? "alloy"
}

export function resolveThemeLabels(themeIds: string[]) {
  return themeIds
    .map((themeId) => PODCAST_THEMES.find((theme) => theme.id === themeId)?.label ?? themeId)
    .filter(Boolean)
}

export async function generatePodcastScript(input: PodcastScriptInput) {
  const settings = await getAppSettings()
  return invoke<PodcastScriptOutput>("generate_podcast_script", {
    input: { ...input, apiKey: input.apiKey ?? settings.openaiApiKey },
  })
}

export async function generatePodcastVoice(input: PodcastVoiceInput) {
  const settings = await getAppSettings()
  return invoke<PodcastVoiceOutput>("generate_podcast_voice", { input: { ...input, apiKey: input.apiKey ?? settings.openaiApiKey } })
}

export async function generateEpisodeGraphic(input: EpisodeGraphicInput) {
  const settings = await getAppSettings()
  return invoke<EpisodeGraphicOutput>("generate_episode_graphic", { input: { ...input, apiKey: input.apiKey ?? settings.openaiApiKey } })
}

export function toAudioUrl(audioPath: string) {
  return convertFileSrc(audioPath)
}

export function toImageUrl(imagePath: string) {
  return convertFileSrc(imagePath)
}
