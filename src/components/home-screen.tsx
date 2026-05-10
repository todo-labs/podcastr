"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AudioPlayer } from "@/components/audio-player"
import { FeedbackDialog } from "@/components/feedback-dialog"
import {
  CheckCircle2,
  Clock,
  FileText,
  Image,
  Loader2,
  Mic,
  MoreVertical,
  Play,
  Save,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  BookmarkPlus,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "@/lib/router"
import { useToast } from "@/hooks/use-toast"
import {
  getAppSettings,
  getGeneratedPodcasts,
  getOnboardingState,
  saveGeneratedPodcast,
  type GeneratedPodcast,
} from "@/lib/persistence"
import {
  generateEpisodeGraphic,
  generatePodcastScript,
  generatePodcastVoice,
  mapVoiceTypeToOpenAIVoice,
  resolveThemeLabels,
  toImageUrl,
} from "@/lib/openai"
import { formatResearchContext, searchEpisodeResearch } from "@/lib/exa"

type Podcast = GeneratedPodcast

const GENERATION_STEPS = [
  { key: "searching", label: "Searching web context", icon: Search, progress: 12 },
  { key: "planning", label: "Planning episode", icon: FileText, progress: 32 },
  { key: "writing", label: "Writing script", icon: Sparkles, progress: 58 },
  { key: "assets", label: "Generating voice and artwork", icon: Image, progress: 84 },
  { key: "saving", label: "Saving episode", icon: Save, progress: 96 },
] as const

type GenerationStage = (typeof GENERATION_STEPS)[number]["key"] | "idle"

export function HomeScreen() {
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackPodcast, setFeedbackPodcast] = useState<Podcast | null>(null)
  const [podcasts, setPodcasts] = useState<Podcast[]>([])
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [voiceType, setVoiceType] = useState("natural")
  const [defaultVoice, setDefaultVoice] = useState("alloy")
  const [scriptModel, setScriptModel] = useState("gpt-5.5")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle")
  const { toast } = useToast()

  const describeError = (error: unknown) => {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === "string") {
      return error
    }

    if (typeof error === "object" && error !== null) {
      const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined
      if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
        return maybeMessage
      }

      try {
        return JSON.stringify(error)
      } catch {
        return "OpenAI generation could not complete"
      }
    }

    return "OpenAI generation could not complete"
  }

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
      setScriptModel(appSettings.scriptModel)
      setPodcasts(
        generatedPodcasts.map((podcast) => ({
          ...podcast,
          generatedAt: new Date(podcast.generatedAt).toLocaleString(),
        })),
      )
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
    setGenerationStage("searching")

    try {
      const themes = selectedThemes.length > 0 ? selectedThemes : ["technology", "science", "business"]
      const resolvedThemes = resolveThemeLabels(themes)
      const researchQuery = `recent news, developments, examples, and analysis about ${resolvedThemes.join(", ")}`
      const research = await searchEpisodeResearch(researchQuery)
      setGenerationStage("planning")
      const researchContext = formatResearchContext(research)
      setGenerationStage("writing")
      const script = await generatePodcastScript({
        themes: resolvedThemes,
        voiceType,
        scriptModel,
        researchContext,
      })

      setGenerationStage("assets")
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

      setGenerationStage("saving")
      await saveGeneratedPodcast({
        id: episode.id,
        title: episode.title,
        description: episode.description,
        duration: episode.duration,
        generatedAt: new Date().toISOString(),
        audioPath: audio.audioPath,
        imagePath: graphic.imagePath,
        hook: script.hook,
        intro: script.intro,
        conclusion: script.conclusion,
        transcript: script.script,
        researchContext,
        researchSources: research.results,
        scriptModel,
      })

      setPodcasts((current) => [episode, ...current])
      setCurrentPodcast(episode)
      toast({
        title: "Podcast generated",
        description: "OpenAI created the script and voice track.",
      })
    } catch (error) {
      console.error("Podcast generation failed:", error)
      toast({
        title: "Generation failed",
        description: describeError(error),
        variant: "destructive",
      })
    } finally {
      setGenerationStage("idle")
      setIsGenerating(false)
    }
  }

  const generationProgress = generationStage === "idle"
    ? 0
    : GENERATION_STEPS.find((step) => step.key === generationStage)?.progress ?? 0

  const currentGenerationLabel = generationStage === "idle"
    ? "Ready to generate"
    : GENERATION_STEPS.find((step) => step.key === generationStage)?.label ?? "Generating"

  const completedSteps = GENERATION_STEPS.filter(
    (step) =>
      generationStage !== "idle" &&
      GENERATION_STEPS.findIndex((candidate) => candidate.key === step.key) <
        GENERATION_STEPS.findIndex((candidate) => candidate.key === generationStage),
  )

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
        {isGenerating && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="font-medium">{currentGenerationLabel}</p>
                </div>
                <p className="text-sm text-muted-foreground">Building the episode before it is saved to your library.</p>
              </div>
              <Badge variant="secondary">{Math.max(1, generationProgress)}%</Badge>
            </div>
            <Progress value={generationProgress} />
            <div className="flex flex-wrap gap-2">
              {GENERATION_STEPS.map((step) => {
                const isComplete = completedSteps.some((item) => item.key === step.key)
                const isActive = generationStage === step.key
                const Icon = step.icon

                return (
                  <Badge
                    key={step.key}
                    variant={isActive ? "default" : isComplete ? "secondary" : "outline"}
                    className="gap-1.5"
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                    {step.label}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Button className="gap-2" onClick={handleGeneratePodcast} disabled={isGenerating}>
            <Sparkles className="w-4 h-4" />
            {isGenerating ? currentGenerationLabel : "Generate New Podcast"}
          </Button>
          <Button
            variant="outline"
            disabled={!currentPodcast}
            onClick={() => {
              if (!currentPodcast) return
              setFeedbackPodcast(currentPodcast)
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

          {filteredPodcasts.length === 0 ? (
            <Empty className="min-h-[360px] border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles />
                </EmptyMedia>
                <EmptyTitle>{searchQuery ? "No episodes found" : "No episodes yet"}</EmptyTitle>
                <EmptyDescription>
                  {searchQuery
                    ? "Try a different search term or generate a new episode."
                    : "Generate your first podcast to add it to your library."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button className="gap-2" onClick={handleGeneratePodcast} disabled={isGenerating}>
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? "Generating..." : "Generate New Podcast"}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
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
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link href={`/episode/${podcast.id}`}>
                        <FileText className="w-4 h-4" />
                        Open Episode
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Audio Player */}
      {currentPodcast && <AudioPlayer podcast={currentPodcast} />}

      {/* Feedback Dialog */}
      {feedbackPodcast && (
        <FeedbackDialog
          open={showFeedback}
          onOpenChange={setShowFeedback}
          podcast={feedbackPodcast}
          initialRating={null}
          onFeedbackSubmitted={() => {}}
        />
      )}
    </div>
  )
}
