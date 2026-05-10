"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AudioPlayer } from "@/components/audio-player"
import { ChevronLeft, ExternalLink, Mic, Clock3, Workflow } from "lucide-react"
import { Link } from "@/lib/router"
import { getGeneratedPodcastById, type GeneratedPodcast } from "@/lib/persistence"
import { toImageUrl } from "@/lib/openai"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Sparkles } from "lucide-react"

type EpisodePageProps = {
  episodeId: string
}

function formatTranscript(transcript: string) {
  return transcript
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function splitTranscriptLines(transcript: string) {
  const paragraphs = formatTranscript(transcript)
  const sentences = paragraphs.flatMap((paragraph) =>
    paragraph
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean),
  )

  if (sentences.length > 0) {
    return sentences
  }

  return transcript
    .split(/\s+/)
    .reduce<string[]>((lines, word) => {
      const lastLine = lines[lines.length - 1] ?? ""
      if (!lastLine) {
        lines.push(word)
        return lines
      }

      if (lastLine.length + word.length + 1 > 84) {
        lines.push(word)
        return lines
      }

      lines[lines.length - 1] = `${lastLine} ${word}`
      return lines
    }, [])
    .filter(Boolean)
}

function formatSourceDate(publishedDate?: string) {
  if (!publishedDate) {
    return "Date unavailable"
  }

  const date = new Date(publishedDate)
  return Number.isNaN(date.getTime()) ? publishedDate : date.toLocaleDateString()
}

function MetaTag({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 border border-border px-2 py-1">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  )
}

function ConsoleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-border last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-24 shrink-0 mt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground leading-relaxed">{value}</span>
    </div>
  )
}

export function EpisodePage({ episodeId }: EpisodePageProps) {
  const [episode, setEpisode] = useState<GeneratedPodcast | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [playbackState, setPlaybackState] = useState({ currentTime: 0, duration: 1, isPlaying: false })
  const transcriptRefs = useRef<Array<HTMLParagraphElement | null>>([])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setIsLoading(true)
      const savedEpisode = await getGeneratedPodcastById(episodeId)
      if (!cancelled) {
        setEpisode(savedEpisode)
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [episodeId])

  const transcriptLines = useMemo(
    () => episode?.transcript ? splitTranscriptLines(episode.transcript) : [],
    [episode],
  )
  const activeLineIndex =
    transcriptLines.length > 0
      ? Math.min(
          transcriptLines.length - 1,
          Math.max(
            0,
            Math.floor((playbackState.currentTime / Math.max(1, playbackState.duration)) * transcriptLines.length),
          ),
        )
      : -1

  useEffect(() => {
    const activeLine = transcriptRefs.current[activeLineIndex]
    if (!activeLine) {
      return
    }

    activeLine.scrollIntoView({
      behavior: playbackState.isPlaying ? "smooth" : "auto",
      block: "center",
    })
  }, [activeLineIndex, playbackState.isPlaying])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-40">
        <header className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="px-6 py-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </header>
        <main className="px-6 py-8 space-y-6 max-w-5xl mx-auto">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </main>
      </div>
    )
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-background pb-40">
        <header className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="px-6 py-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 font-mono text-xs tracking-widest">
                <ChevronLeft className="w-4 h-4" />
                LIBRARY
              </Button>
            </Link>
          </div>
        </header>
        <main className="px-6 py-8 max-w-5xl mx-auto">
          <Empty className="min-h-[420px] border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>Episode not found</EmptyTitle>
              <EmptyDescription>
                This episode may have been removed or the library entry is no longer available.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/">
                <Button className="gap-2 font-mono text-xs tracking-widest">
                  <ChevronLeft className="w-4 h-4" />
                  RETURN HOME
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="px-6 py-4 flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Episode detail</p>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-foreground">Podcastr</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MetaTag icon={Clock3} label={episode.duration} />
            <MetaTag icon={Mic} label="Audio" />
            <MetaTag icon={Workflow} label={episode.scriptModel || "gpt-5.5"} />
          </div>
        </div>
      </header>

      <main className="px-6 py-8 space-y-8 max-w-5xl mx-auto">
        {/* Hero */}
        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Cover art */}
          <div className="border border-border overflow-hidden aspect-square lg:aspect-auto">
            <img
              src={episode.imagePath ? toImageUrl(episode.imagePath) : "/placeholder.svg"}
              alt={episode.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Console readout */}
          <div className="border border-border p-5 space-y-4">
            {/* Status bar */}
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Generated</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(episode.generatedAt).toLocaleString()}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold tracking-tight text-balance text-foreground leading-tight">
              {episode.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">{episode.description}</p>

            {/* Metadata rows */}
            <div className="pt-2">
              {episode.hook && <ConsoleRow label="Hook" value={episode.hook} />}
              {episode.intro && <ConsoleRow label="Intro" value={episode.intro} />}
              {episode.conclusion && <ConsoleRow label="Conclusion" value={episode.conclusion} />}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="transcript" className="space-y-0">
          <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 h-auto p-0">
            {["Overview", "Transcript", "Research"].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab.toLowerCase()}
                className="font-mono text-[10px] uppercase tracking-widest px-5 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-0 pt-6 space-y-0">
            <div className="border border-border divide-y divide-border px-5">
              <ConsoleRow label="Generated" value={new Date(episode.generatedAt).toLocaleString()} />
              <ConsoleRow label="Audio file" value={episode.audioPath} />
              {episode.duration && <ConsoleRow label="Duration" value={episode.duration} />}
              {episode.scriptModel && <ConsoleRow label="Model" value={episode.scriptModel} />}
            </div>
          </TabsContent>

          {/* Transcript */}
          <TabsContent value="transcript" className="mt-0 pt-6">
            {episode.transcript ? (
              <div className="space-y-0 max-h-[60vh] overflow-y-auto pr-2">
                {transcriptLines.map((line, index) => {
                  const isActive = index === activeLineIndex
                  return (
                    <p
                      key={`${index}-${line}`}
                      ref={(el) => {
                        transcriptRefs.current[index] = el
                      }}
                      className={[
                        "border-l-2 pl-4 py-2 font-mono text-sm leading-7 transition-colors whitespace-pre-wrap",
                        isActive
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground",
                      ].join(" ")}
                    >
                      {line}
                    </p>
                  )
                })}
              </div>
            ) : (
              <div className="border border-border p-8 flex flex-col items-center gap-3 text-center">
                <Mic className="w-5 h-5 text-muted-foreground" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Transcript unavailable
                </p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  This episode was generated before transcripts were saved. Regenerate it to get a full transcript.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Research */}
          <TabsContent value="research" className="mt-0 pt-6">
            {episode.researchSources && episode.researchSources.length > 0 ? (
              <div className="border border-border divide-y divide-border">
                {episode.researchSources.map((source) => (
                  <div key={source.url} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-sm text-foreground leading-snug line-clamp-2">{source.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                          {formatSourceDate(source.publishedDate)}
                          {source.author ? ` — ${source.author}` : ""}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" asChild>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    </div>

                    {source.highlights.length > 0 && (
                      <div className="space-y-2 pl-3 border-l border-border">
                        {source.highlights.slice(0, 3).map((highlight) => (
                          <p key={highlight} className="text-xs text-muted-foreground leading-relaxed">
                            {highlight}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : episode.researchContext ? (
              <pre className="font-mono text-xs leading-7 whitespace-pre-wrap text-foreground border border-border p-5">
                {episode.researchContext}
              </pre>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                No research context was stored for this episode.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AudioPlayer podcast={episode} onProgress={setPlaybackState} />
    </div>
  )
}
