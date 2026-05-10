"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AudioPlayer } from "@/components/audio-player"
import { FeedbackDialog } from "@/components/feedback-dialog"
import { Sparkles, Search, Settings, Play, Clock, TrendingUp, BookmarkPlus, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "@/lib/router"
import { useToast } from "@/hooks/use-toast"
import { getAppSettings, getGeneratedPodcasts, getOnboardingState, saveGeneratedPodcast } from "@/lib/persistence"
import {
  generateEpisodeGraphic,
  generatePodcastScript,
  generatePodcastVoice,
  mapVoiceTypeToOpenAIVoice,
  resolveThemeLabels,
  toImageUrl,
} from "@/lib/openai"
import { formatResearchContext, searchEpisodeResearch } from "@/lib/exa"

interface Podcast {
  id: string
  title: string
  description: string
  duration: string
  generatedAt: string
  audioPath?: string
  imagePath?: string
}

const MOCK_PODCASTS: Podcast[] = [
  {
    id: "1",
    title: "The Future of AI in Healthcare",
    description: "Exploring how artificial intelligence is revolutionizing medical diagnosis and treatment",
    duration: "32:45",
    generatedAt: "2 hours ago",
  },
  {
    id: "2",
    title: "Understanding Quantum Computing",
    description: "A deep dive into the principles and potential applications of quantum computers",
    duration: "28:12",
    generatedAt: "5 hours ago",
  },
  {
    id: "3",
    title: "Climate Change Solutions",
    description: "Innovative approaches to combating global warming and environmental challenges",
    duration: "35:20",
    generatedAt: "1 day ago",
  },
  {
    id: "4",
    title: "The Psychology of Productivity",
    description: "Understanding how our minds work and optimizing for peak performance",
    duration: "41:15",
    generatedAt: "1 day ago",
  },
  {
    id: "5",
    title: "Space Exploration in 2026",
    description: "Latest developments in space technology and upcoming missions to Mars",
    duration: "38:50",
    generatedAt: "2 days ago",
  },
  {
    id: "6",
    title: "The Art of Storytelling",
    description: "Mastering narrative techniques used by the world's greatest storytellers",
    duration: "29:33",
    generatedAt: "2 days ago",
  },
]

export function HomeScreen() {
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackPodcast, setFeedbackPodcast] = useState<Podcast>(MOCK_PODCASTS[0])
  const [podcasts, setPodcasts] = useState<Podcast[]>(MOCK_PODCASTS)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [voiceType, setVoiceType] = useState("natural")
  const [defaultVoice, setDefaultVoice] = useState("alloy")
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [onboardingState, appSettings, generatedPodcasts] = await Promise.all([
        getOnboardingState(),
        getAppSettings(),
        getGeneratedPodcasts(),
      ])
      if (cancelled) return

      setSelectedThemes(onboardingState.selectedThemes)
      setVoiceType(appSettings.voiceType)
      setDefaultVoice(appSettings.defaultVoice)
      setPodcasts([
        ...generatedPodcasts.map((podcast) => ({
          ...podcast,
          generatedAt: new Date(podcast.generatedAt).toLocaleString(),
        })),
        ...MOCK_PODCASTS,
      ])
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handlePlayPodcast = (podcast: Podcast) => {
    setCurrentPodcast(podcast)
  }

  const handleGeneratePodcast = async () => {
    if (isGenerating) {
      return
    }

    setIsGenerating(true)

    try {
      const themes = selectedThemes.length > 0 ? selectedThemes : ["technology", "science", "business"]
      const resolvedThemes = resolveThemeLabels(themes)
      const researchQuery = `recent news, developments, examples, and analysis about ${resolvedThemes.join(", ")}`
      const research = await searchEpisodeResearch(researchQuery)
      const researchContext = formatResearchContext(research)
      const script = await generatePodcastScript({
        themes: resolvedThemes,
        voiceType,
        durationMinutes: 4,
        researchContext,
      })

      const [audio, graphic] = await Promise.all([
        generatePodcastVoice({
          text: script.script,
          voice: defaultVoice || mapVoiceTypeToOpenAIVoice(voiceType),
          instructions: script.voiceInstructions,
        }),
        generateEpisodeGraphic({
          title: script.title,
          summary: script.summary,
          themes: resolvedThemes,
        }),
      ])

      const episode: Podcast = {
        id: String(Date.now()),
        title: script.title,
        description: script.summary,
        duration: `${script.estimatedDurationMinutes}:00`,
        generatedAt: new Date().toLocaleString(),
        audioPath: audio.audioPath,
        imagePath: graphic.imagePath,
      }

      await saveGeneratedPodcast({
        id: episode.id,
        title: episode.title,
        description: episode.description,
        duration: episode.duration,
        generatedAt: new Date().toISOString(),
        audioPath: audio.audioPath,
        imagePath: graphic.imagePath,
      })

      setPodcasts((current) => [episode, ...current])
      setCurrentPodcast(episode)
      toast({
        title: "Podcast generated",
        description: "OpenAI created the script and voice track.",
      })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "OpenAI generation could not complete",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredPodcasts = podcasts.filter((podcast) =>
    podcast.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background flex flex-col pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Podcastr</span>
            </div>

            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search podcasts..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Button className="gap-2" onClick={handleGeneratePodcast} disabled={isGenerating}>
            <Sparkles className="w-4 h-4" />
            {isGenerating ? "Generating..." : "Generate New Podcast"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFeedbackPodcast(currentPodcast ?? MOCK_PODCASTS[0])
              setShowFeedback(true)
            }}
          >
            Provide Feedback
          </Button>
        </div>

        {/* Podcast Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Your Library</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Trending
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <Clock className="w-4 h-4" />
                Recent
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPodcasts.map((podcast) => (
              <Card
                key={podcast.id}
                className="group overflow-hidden hover:shadow-lg transition-all hover:border-primary/50"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
                        {podcast.imagePath ? (
                          <img src={toImageUrl(podcast.imagePath)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Play className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
                          Episode #{podcast.id}
                        </div>
                        <h3 className="font-semibold text-base leading-tight line-clamp-2 text-balance">
                          {podcast.title}
                        </h3>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <BookmarkPlus className="w-4 h-4 mr-2" />
                          Save for Later
                        </DropdownMenuItem>
                        <DropdownMenuItem>Share</DropdownMenuItem>
                        <DropdownMenuItem>Download</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{podcast.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {podcast.duration}
                    </span>
                    <span className="flex-1 text-right">{podcast.generatedAt}</span>
                  </div>

                  <Button className="w-full gap-2" variant="secondary" onClick={() => handlePlayPodcast(podcast)}>
                    <Play className="w-4 h-4" />
                    Play Episode
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Audio Player */}
      {currentPodcast && <AudioPlayer podcast={currentPodcast} />}

      {/* Feedback Dialog */}
      <FeedbackDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        podcast={feedbackPodcast}
        initialRating={null}
        onFeedbackSubmitted={() => {}}
      />
    </div>
  )
}
