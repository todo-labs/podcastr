type AppSettings = {
  autoPlay: boolean
  downloadQuality: string
  voiceType: string
  playbackSpeed: number
  autoDownload: boolean
  notifications: boolean
  darkMode: boolean
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

type SqliteDatabase = {
  execute(sql: string, bindValues?: unknown[]): Promise<unknown>
  select<T = unknown>(sql: string, bindValues?: unknown[]): Promise<T>
}

const DB_URL = "sqlite:podcastr.db"
const APP_SETTINGS_KEY = "app_settings"
const ONBOARDING_KEY = "onboarding_state"

const DEFAULT_SETTINGS: AppSettings = {
  autoPlay: true,
  downloadQuality: "high",
  voiceType: "natural",
  playbackSpeed: 1,
  autoDownload: false,
  notifications: true,
  darkMode: true,
}

let dbPromise: Promise<SqliteDatabase | null> | null = null

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
