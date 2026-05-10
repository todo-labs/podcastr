export const PODCAST_THEMES = [
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "business", label: "Business", icon: "💼" },
  { id: "science", label: "Science", icon: "🔬" },
  { id: "health", label: "Health & Wellness", icon: "🏃" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "news", label: "News & Politics", icon: "📰" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "comedy", label: "Comedy", icon: "😂" },
  { id: "history", label: "History", icon: "🏛️" },
  { id: "true-crime", label: "True Crime", icon: "🔍" },
  { id: "arts", label: "Arts & Culture", icon: "🎨" },
  { id: "food", label: "Food & Cooking", icon: "🍳" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "psychology", label: "Psychology", icon: "🧠" },
] as const

export type PodcastThemeId = (typeof PODCAST_THEMES)[number]["id"]
