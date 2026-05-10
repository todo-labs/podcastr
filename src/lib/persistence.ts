type AppSettings = {
  autoPlay: boolean
  downloadQuality: string
  voiceType: string
  defaultVoice: string
  scriptModel: string
  playbackSpeed: number
  autoDownload: boolean
  notifications: boolean
  darkMode: boolean
  openaiApiKey: string
  exaApiKey: string
}

type OnboardingState = {
  completed: boolean
  selectedThemes: string[]
}

type FeedbackRating = "positive" | "negative" | "neutral"

type FeedbackEntry = {
  podcastId: string
  podcastTitle: string
  rating: FeedbackRating
  feedback: string
  timestamp: string
}

export type ResearchSource = {
  title: string
  url: string
  publishedDate?: string
  author?: string
  highlights: string[]
}

export type GeneratedPodcast = {
  id: string
  title: string
  description: string
  duration: string
  generatedAt: string
  audioPath: string
  imagePath: string
  transcript?: string
  hook?: string
  intro?: string
  conclusion?: string
  researchContext?: string
  researchSources?: ResearchSource[]
  scriptModel?: string
}

type SqliteDatabase = {
  execute(sql: string, bindValues?: unknown[]): Promise<unknown>
  select<T = unknown>(sql: string, bindValues?: unknown[]): Promise<T>
}

const DB_URL = "sqlite:podcastr.db"
const APP_SETTINGS_KEY = "app_settings"
const ONBOARDING_KEY = "onboarding_state"
const GENERATED_PODCASTS_KEY = "generated_podcasts"

const DEFAULT_SETTINGS: AppSettings = {
  autoPlay: true,
  downloadQuality: "high",
  voiceType: "natural",
  defaultVoice: "alloy",
  scriptModel: "gpt-5.5",
  playbackSpeed: 1,
  autoDownload: false,
  notifications: true,
  darkMode: true,
  openaiApiKey: "",
  exaApiKey: "",
}

let dbPromise: Promise<SqliteDatabase | null> | null = null

export function applyAppTheme(darkMode: boolean) {
  if (typeof document === "undefined") {
    return
  }

  document.documentElement.classList.toggle("dark", darkMode)
}

function isDesktopRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

async function loadDatabase() {
  if (!isDesktopRuntime()) {
    return null
  }

  if (!dbPromise) {
    dbPromise = import("@tauri-apps/plugin-sql")
      .then(({ default: Database }) => Database.load(DB_URL))
      .then(async (db) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `)

        await db.execute(`
          CREATE TABLE IF NOT EXISTS podcast_feedback (
            podcast_id TEXT PRIMARY KEY,
            podcast_title TEXT NOT NULL,
            rating TEXT NOT NULL,
            feedback TEXT NOT NULL,
            timestamp TEXT NOT NULL
          )
        `)

        await db.execute(`
          CREATE TABLE IF NOT EXISTS generated_podcasts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            duration TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            audio_path TEXT NOT NULL,
            image_path TEXT NOT NULL,
            hook TEXT NOT NULL DEFAULT '',
            intro TEXT NOT NULL DEFAULT '',
            conclusion TEXT NOT NULL DEFAULT '',
            transcript TEXT NOT NULL DEFAULT '',
            research_context TEXT NOT NULL DEFAULT '',
            research_sources TEXT NOT NULL DEFAULT '[]',
            script_model TEXT NOT NULL DEFAULT ''
          )
        `)

        for (const statement of [
          "ALTER TABLE generated_podcasts ADD COLUMN hook TEXT NOT NULL DEFAULT ''",
          "ALTER TABLE generated_podcasts ADD COLUMN intro TEXT NOT NULL DEFAULT ''",
          "ALTER TABLE generated_podcasts ADD COLUMN conclusion TEXT NOT NULL DEFAULT ''",
          "ALTER TABLE generated_podcasts ADD COLUMN transcript TEXT NOT NULL DEFAULT ''",
          "ALTER TABLE generated_podcasts ADD COLUMN research_context TEXT NOT NULL DEFAULT ''",
          "ALTER TABLE generated_podcasts ADD COLUMN research_sources TEXT NOT NULL DEFAULT '[]'",
          "ALTER TABLE generated_podcasts ADD COLUMN script_model TEXT NOT NULL DEFAULT ''",
        ]) {
          try {
            await db.execute(statement)
          } catch (error) {
            if (!String(error).toLowerCase().includes("duplicate column")) {
              throw error
            }
          }
        }

        return db
      })
  }

  return dbPromise
}

async function readStateValue(key: string) {
  const db = await loadDatabase()
  if (!db) {
    return localStorage.getItem(key)
  }

  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_state WHERE key = ? LIMIT 1",
    [key],
  )

  return rows[0]?.value ?? null
}

async function writeStateValue(key: string, value: string) {
  const db = await loadDatabase()
  if (!db) {
    localStorage.setItem(key, value)
    return
  }

  await db.execute(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  )
}

export async function getAppSettings(): Promise<AppSettings> {
  const raw = await readStateValue(APP_SETTINGS_KEY)
  if (!raw) {
    return DEFAULT_SETTINGS
  }

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveAppSettings(settings: AppSettings) {
  applyAppTheme(settings.darkMode)
  await writeStateValue(APP_SETTINGS_KEY, JSON.stringify(settings))
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const raw = await readStateValue(ONBOARDING_KEY)
  if (!raw) {
    return {
      completed: false,
      selectedThemes: [],
    }
  }

  try {
    const parsed = JSON.parse(raw) as OnboardingState
    const legacyState = parsed as unknown as { selectedTopics?: string[] }
    const selectedThemes = Array.isArray(parsed.selectedThemes)
      ? parsed.selectedThemes
      : Array.isArray(legacyState.selectedTopics)
        ? legacyState.selectedTopics
        : []

    return {
      completed: !!parsed.completed,
      selectedThemes,
    }
  } catch {
    return {
      completed: false,
      selectedThemes: [],
    }
  }
}

export async function saveOnboardingState(state: OnboardingState) {
  await writeStateValue(ONBOARDING_KEY, JSON.stringify(state))
}

export async function resetOnboardingState() {
  await saveOnboardingState({
    completed: false,
    selectedThemes: [],
  })
}

export async function clearAllAppData() {
  const db = await loadDatabase()
  if (!db) {
    localStorage.clear()
    return
  }

  await db.execute("DELETE FROM app_state")
  await db.execute("DELETE FROM podcast_feedback")
  await db.execute("DELETE FROM generated_podcasts")
}

export async function getPodcastFeedback(podcastId: string) {
  const db = await loadDatabase()
  if (!db) {
    const allFeedback = JSON.parse(localStorage.getItem("podcast_feedback") || "[]") as FeedbackEntry[]
    return allFeedback.find((entry) => entry.podcastId === podcastId) ?? null
  }

  const rows = await db.select<Array<FeedbackEntry>>(
    "SELECT podcast_id as podcastId, podcast_title as podcastTitle, rating, feedback, timestamp FROM podcast_feedback WHERE podcast_id = ? LIMIT 1",
    [podcastId],
  )

  return rows[0] ?? null
}

export async function savePodcastFeedback(entry: FeedbackEntry) {
  const db = await loadDatabase()
  if (!db) {
    const existingFeedback = JSON.parse(localStorage.getItem("podcast_feedback") || "[]") as FeedbackEntry[]
    const filteredFeedback = existingFeedback.filter((item) => item.podcastId !== entry.podcastId)
    filteredFeedback.push(entry)
    localStorage.setItem("podcast_feedback", JSON.stringify(filteredFeedback))
    return
  }

  await db.execute(
    `INSERT INTO podcast_feedback (podcast_id, podcast_title, rating, feedback, timestamp)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(podcast_id) DO UPDATE SET
       podcast_title = excluded.podcast_title,
       rating = excluded.rating,
       feedback = excluded.feedback,
       timestamp = excluded.timestamp`,
    [entry.podcastId, entry.podcastTitle, entry.rating, entry.feedback, entry.timestamp],
  )
}

export async function getGeneratedPodcasts(): Promise<GeneratedPodcast[]> {
  const db = await loadDatabase()
  if (!db) {
    const raw = localStorage.getItem(GENERATED_PODCASTS_KEY)
    return raw
      ? (JSON.parse(raw) as GeneratedPodcast[]).map((podcast) => ({
          ...podcast,
          hook: podcast.hook ?? "",
          intro: podcast.intro ?? "",
          conclusion: podcast.conclusion ?? "",
          transcript: podcast.transcript ?? "",
          researchContext: podcast.researchContext ?? "",
          researchSources: podcast.researchSources ?? [],
          scriptModel: podcast.scriptModel ?? "",
        }))
      : []
  }

  const rows = await db.select<Array<GeneratedPodcast & { researchSources?: string }>>(
    `SELECT
      id,
      title,
      description,
      duration,
      generated_at as generatedAt,
      audio_path as audioPath,
      image_path as imagePath,
      hook,
      intro,
      conclusion,
      transcript,
      research_context as researchContext,
      research_sources as researchSources,
      script_model as scriptModel
     FROM generated_podcasts
     ORDER BY generated_at DESC`,
  )

  return rows.map((podcast) => ({
    ...podcast,
    hook: podcast.hook ?? "",
    intro: podcast.intro ?? "",
    conclusion: podcast.conclusion ?? "",
    transcript: podcast.transcript ?? "",
    researchContext: podcast.researchContext ?? "",
    researchSources: podcast.researchSources ? (JSON.parse(podcast.researchSources) as ResearchSource[]) : [],
    scriptModel: podcast.scriptModel ?? "",
  }))
}

export async function getGeneratedPodcastById(id: string): Promise<GeneratedPodcast | null> {
  const db = await loadDatabase()
  if (!db) {
    const raw = localStorage.getItem(GENERATED_PODCASTS_KEY)
    const podcasts = raw ? (JSON.parse(raw) as GeneratedPodcast[]) : []
    const podcast = podcasts.find((item) => item.id === id)
    return podcast
      ? {
          ...podcast,
          hook: podcast.hook ?? "",
          intro: podcast.intro ?? "",
          conclusion: podcast.conclusion ?? "",
          transcript: podcast.transcript ?? "",
          researchContext: podcast.researchContext ?? "",
          researchSources: podcast.researchSources ?? [],
          scriptModel: podcast.scriptModel ?? "",
        }
      : null
  }

  const rows = await db.select<Array<GeneratedPodcast & { researchSources?: string }>>(
    `SELECT
      id,
      title,
      description,
      duration,
      generated_at as generatedAt,
      audio_path as audioPath,
      image_path as imagePath,
      hook,
      intro,
      conclusion,
      transcript,
      research_context as researchContext,
      research_sources as researchSources,
      script_model as scriptModel
     FROM generated_podcasts
     WHERE id = ?
     LIMIT 1`,
    [id],
  )

  const podcast = rows[0]
  if (!podcast) {
    return null
  }

  return {
    ...podcast,
    hook: podcast.hook ?? "",
    intro: podcast.intro ?? "",
    conclusion: podcast.conclusion ?? "",
    transcript: podcast.transcript ?? "",
    researchContext: podcast.researchContext ?? "",
    researchSources: podcast.researchSources ? (JSON.parse(podcast.researchSources) as ResearchSource[]) : [],
    scriptModel: podcast.scriptModel ?? "",
  }
}

export async function saveGeneratedPodcast(entry: GeneratedPodcast) {
  const db = await loadDatabase()
  if (!db) {
    const existing = JSON.parse(localStorage.getItem(GENERATED_PODCASTS_KEY) || "[]") as GeneratedPodcast[]
    const filtered = existing.filter((podcast) => podcast.id !== entry.id)
    filtered.unshift({
      ...entry,
      hook: entry.hook ?? "",
      intro: entry.intro ?? "",
      conclusion: entry.conclusion ?? "",
      transcript: entry.transcript ?? "",
      researchContext: entry.researchContext ?? "",
      researchSources: entry.researchSources ?? [],
      scriptModel: entry.scriptModel ?? "",
    })
    localStorage.setItem(GENERATED_PODCASTS_KEY, JSON.stringify(filtered))
    return
  }

  await db.execute(
    `INSERT INTO generated_podcasts (id, title, description, duration, generated_at, audio_path, image_path, hook, intro, conclusion, transcript, research_context, research_sources, script_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       duration = excluded.duration,
       generated_at = excluded.generated_at,
       audio_path = excluded.audio_path,
       image_path = excluded.image_path,
       hook = excluded.hook,
       intro = excluded.intro,
       conclusion = excluded.conclusion,
       transcript = excluded.transcript,
       research_context = excluded.research_context,
       research_sources = excluded.research_sources,
       script_model = excluded.script_model`,
    [
      entry.id,
      entry.title,
      entry.description,
      entry.duration,
      entry.generatedAt,
      entry.audioPath,
      entry.imagePath,
      entry.hook ?? "",
      entry.intro ?? "",
      entry.conclusion ?? "",
      entry.transcript ?? "",
      entry.researchContext ?? "",
      JSON.stringify(entry.researchSources ?? []),
      entry.scriptModel ?? "",
    ],
  )
}
