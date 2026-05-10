"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AudioPlayer } from "@/components/audio-player"
import { FeedbackDialog } from "@/components/feedback-dialog"
import {
  CheckCircle2,
  FileText,
  Image,
  Loader2,
  Mic,
  MoreVertical,
  Play,
  Pause,
  Save,
  Search,
  Settings,
  Sparkles,
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
import { cn } from "@/lib/utils"

type Podcast = GeneratedPodcast

const GENERATION_STEPS = [
  { key: "searching", label: "Searching web context", icon: Search, progress: 12 },
  { key: "planning", label: "Planning episode", icon: FileText, progress: 32 },
  { key: "writing", label: "Writing script", icon: Sparkles, progress: 58 },
  { key: "assets", label: "Generating voice and artwork", icon: Image, progress: 84 },
  { key: "saving", label: "Saving episode", icon: Save, progress: 96 },
] as const

type GenerationStage = (typeof GENERATION_STEPS)[number]["key"] | "idle"

/* ─── Waveform bars — the visual language of this app ───────────── */
function WaveformBars({
  isAnimating,
  bars = 48,
  height = 48,
  className,
}: {
  isAnimating: boolean
  bars?: number
  height?: number
  className?: string
}) {
  const heights = useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      const h =
        Math.sin(i * 0.38) * 0.35 +
        Math.sin(i * 0.85) * 0.25 +
        Math.cos(i * 0.22) * 0.20 +
        0.42
      return Math.max(0.06, Math.min(1, Math.abs(h)))
    })
  }, [bars])

  return (
    <div
      className={cn("flex items-center gap-[2px]", className)}
      style={{ height }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 max-w-[4px] rounded-full bg-primary"
          style={{
            height: `${h * 100}%`,
            transformOrigin: "center",
            opacity: isAnimating ? 0.9 : 0.35,
            animation: isAnimating
              ? `waveBar ${500 + ((i * 73) % 500)}ms ease-in-out ${(i * 41) % 600}ms infinite alternate`
              : "none",
          }}
        />
      ))}
    </div>
  )
}

/* ─── Mini playing indicator — 3 bars on episode rows ──────────── */
function PlayingIndicator({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center gap-[2px] w-4 h-4" aria-hidden>
      {[0.65, 1, 0.5].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary"
          style={{
            height: `${h * 100}%`,
            transformOrigin: "center",
            animation: isPlaying
              ? `waveBar ${450 + i * 150}ms ease-in-out ${i * 120}ms infinite alternate`
              : "none",
            opacity: isPlaying ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Episode row — broadcast schedule entry ────────────────────── */
function EpisodeRow({
  podcast,
  index,
  isActive,
  onPlay,
}: {
  podcast: Podcast
  index: number
  isActive: boolean
  onPlay: () => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50",
        isActive && "bg-primary/8",
      )}
    >
      {/* Episode number */}
      <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Artwork */}
      <div className="w-9 h-9 rounded-sm overflow-hidden bg-muted shrink-0 border border-border">
        {podcast.imagePath ? (
          <img src={toImageUrl(podcast.imagePath)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Title + timestamp */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={cn("text-sm leading-tight truncate", isActive ? "text-primary" : "text-foreground")}>
          {podcast.title}
        </p>
        <p className="text-xs text-muted-foreground">{podcast.generatedAt}</p>
      </div>

      {/* Duration */}
      <span className="text-xs tabular-nums text-muted-foreground shrink-0">{podcast.duration}</span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPlay}
          aria-label={isActive ? "Now playing" : "Play episode"}
        >
          {isActive ? (
            <PlayingIndicator isPlaying />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current opacity-60 group-hover:opacity-100 transition-opacity" />
          )}
        </Button>

        <Link href={`/episode/${podcast.id}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem asChild>
              <Link href={`/episode/${podcast.id}`}>
                <FileText className="w-3.5 h-3.5 mr-2" />
                View episode
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Download</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/* ─── Home screen ────────────────────────────────────────────────── */
export function HomeScreen() {
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [podcasts, setPodcasts] = useState<Podcast[]>([])
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [voiceType, setVoiceType] = useState("natural")
  const [defaultVoice, setDefaultVoice] = useState("alloy")
  const [scriptModel, setScriptModel] = useState("gpt-5.5")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle")
  const { toast } = useToast()

  const describeError = (error: unknown) => {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    if (typeof error === "object" && error !== null) {
      const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined
      if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) return maybeMessage
      try { return JSON.stringify(error) } catch { return "OpenAI generation could not complete" }
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
    return () => { cancelled = true }
  }, [])

  const handlePlayPodcast = (podcast: Podcast) => {
    setCurrentPodcast(podcast)
  }

  const handleGeneratePodcast = async () => {
    if (isGenerating) return
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
      const script = await generatePodcastScript({ themes: resolvedThemes, voiceType, scriptModel, researchContext })

      setGenerationStage("assets")
      const [audio, graphic] = await Promise.all([
        generatePodcastVoice({
          text: script.script,
          voice: defaultVoice || mapVoiceTypeToOpenAIVoice(voiceType),
          instructions: script.voiceInstructions,
        }),
        generateEpisodeGraphic({ title: script.title, summary: script.summary, themes: resolvedThemes }),
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
      toast({ title: "Episode ready", description: "Your briefing has been generated." })
    } catch (error) {
      console.error("Podcast generation failed:", error)
      toast({ title: "Generation failed", description: describeError(error), variant: "destructive" })
    } finally {
      setGenerationStage("idle")
      setIsGenerating(false)
    }
  }

  const currentGenerationLabel =
    generationStage === "idle"
      ? "Ready"
      : (GENERATION_STEPS.find((step) => step.key === generationStage)?.label ?? "Generating")

  const completedSteps = GENERATION_STEPS.filter(
    (step) =>
      generationStage !== "idle" &&
      GENERATION_STEPS.findIndex((c) => c.key === step.key) <
        GENERATION_STEPS.findIndex((c) => c.key === generationStage),
  )

  const filteredPodcasts = podcasts.filter((podcast) =>
    podcast.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background flex flex-col pb-28">
      {/* Header — broadcast deck nameplate */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="container mx-auto px-5 py-3 flex items-center justify-between gap-4">
          {/* Logo — waveform mark + name */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-end gap-[2px] h-4" aria-hidden>
              {[0.4, 0.7, 1, 0.8, 0.55, 0.35].map((h, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full bg-primary"
                  style={{ height: `${h * 100}%` }}
                />
              ))}
            </div>
            <span className="text-xs tracking-[0.18em] uppercase text-foreground">PODCASTR</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search library..."
              className="pl-8 h-7 text-xs bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-5 py-6 space-y-6">
        {/* ── Generate section — the broadcast booth ── */}
        <div className="border border-border rounded-sm overflow-hidden">
          {/* Studio status bar */}
          <div className="px-5 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isGenerating
                    ? "bg-destructive"
                    : "bg-muted-foreground",
                )}
                style={isGenerating ? { animation: "signalBlink 1s ease-in-out infinite" } : undefined}
              />
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                {isGenerating ? "On Air" : "Studio"}
              </span>
            </div>
            {isGenerating && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {GENERATION_STEPS.find((s) => s.key === generationStage)?.progress ?? 0}%
              </span>
            )}
          </div>

          {/* Waveform + generate action */}
          <div className="px-5 py-6 flex items-center gap-8">
            <div className="flex-1 min-w-0 space-y-4">
              <WaveformBars isAnimating={isGenerating} bars={52} height={44} />
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {isGenerating ? currentGenerationLabel : "Generate episode"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isGenerating
                    ? "AI is researching and producing your briefing..."
                    : "AI researches, writes, and voices your next episode"}
                </p>
              </div>
            </div>

            <Button
              onClick={handleGeneratePodcast}
              disabled={isGenerating}
              className="shrink-0 gap-2 h-9 px-5 text-xs tracking-wide"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isGenerating ? "Generating" : "Generate"}
            </Button>
          </div>

          {/* Generation step pipeline */}
          {isGenerating && (
            <div className="border-t border-border px-5 py-3 flex flex-wrap gap-x-5 gap-y-2">
              {GENERATION_STEPS.map((step) => {
                const isComplete = completedSteps.some((item) => item.key === step.key)
                const isActive = generationStage === step.key

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] tracking-wide",
                      isActive
                        ? "text-foreground"
                        : isComplete
                          ? "text-primary"
                          : "text-muted-foreground/50",
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-current" />
                    )}
                    {step.label}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Library ── */}
        <div className="space-y-3">
          {/* Library header */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Library</span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground tabular-nums">{filteredPodcasts.length} episodes</span>
          </div>

          {filteredPodcasts.length === 0 ? (
            /* Empty state */
            <div className="border border-border rounded-sm py-16 px-6 flex flex-col items-center gap-5">
              <WaveformBars isAnimating={false} bars={24} height={32} />
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No episodes match your search" : "No episodes yet"}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-muted-foreground/60">
                    Generate your first episode above
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Episode list — broadcast schedule */
            <div className="border border-border rounded-sm overflow-hidden divide-y divide-border">
              {filteredPodcasts.map((podcast, index) => (
                <EpisodeRow
                  key={podcast.id}
                  podcast={podcast}
                  index={index}
                  isActive={currentPodcast?.id === podcast.id}
                  onPlay={() => handlePlayPodcast(podcast)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Audio player */}
      {currentPodcast && <AudioPlayer podcast={currentPodcast} />}
    </div>
  )
}
