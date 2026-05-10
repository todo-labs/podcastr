"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AudioPlayer } from "@/components/audio-player"
import { ChevronLeft, Clock3, ExternalLink, FileText, Mic, Sparkles, Workflow } from "lucide-react"
import { Link } from "@/lib/router"
import { getGeneratedPodcastById, type GeneratedPodcast } from "@/lib/persistence"
import { toImageUrl } from "@/lib/openai"

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-40">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-[360px] w-full rounded-xl" />
          <Skeleton className="h-[240px] w-full rounded-xl" />
        </main>
      </div>
    )
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-background pb-40">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back to library
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
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
                <Button className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  Return home
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        </main>
      </div>
    )
  }

  const transcriptLines = useMemo(
    () => splitTranscriptLines(episode.transcript || episode.description),
    [episode.transcript, episode.description],
  )
  const activeLineIndex =
    transcriptLines.length > 0
      ? Math.min(
          transcriptLines.length - 1,
          Math.max(0, Math.floor((playbackState.currentTime / Math.max(1, playbackState.duration)) * transcriptLines.length)),
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

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <p className="text-sm text-muted-foreground">Episode detail</p>
                <h1 className="text-lg font-semibold tracking-tight">Podcastr</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Clock3 className="w-3 h-3" />
                {episode.duration}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Mic className="w-3 h-3" />
                Audio
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Workflow className="w-3 h-3" />
                {episode.scriptModel || "gpt-5.5"}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="overflow-hidden p-0">
            <div className="aspect-square bg-muted">
              <img
                src={episode.imagePath ? toImageUrl(episode.imagePath) : "/placeholder.svg"}
                alt={episode.title}
                className="h-full w-full object-cover"
              />
            </div>
          </Card>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Generated</Badge>
                <Badge variant="outline">{new Date(episode.generatedAt).toLocaleString()}</Badge>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-balance">{episode.title}</h2>
              <p className="text-muted-foreground leading-7 max-w-3xl">{episode.description}</p>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4 gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hook</p>
                <p className="text-sm leading-6">{episode.hook || "No hook saved for this episode."}</p>
              </Card>
              <Card className="p-4 gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Intro</p>
                <p className="text-sm leading-6">{episode.intro || "No intro saved for this episode."}</p>
              </Card>
              <Card className="p-4 gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conclusion</p>
                <p className="text-sm leading-6">{episode.conclusion || "No conclusion saved for this episode."}</p>
              </Card>
            </div>
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Generated at</p>
                  <p className="text-sm">{new Date(episode.generatedAt).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Audio file</p>
                  <p className="text-sm truncate">{episode.audioPath}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold">Transcript</h3>
              </div>
              <Separator />
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                {transcriptLines.length > 0 ? (
                  transcriptLines.map((line, index) => {
                    const isActive = index === activeLineIndex

                    return (
                      <p
                        key={`${index}-${line}`}
                        ref={(element) => {
                          transcriptRefs.current[index] = element
                        }}
                        className={[
                          "rounded-lg border px-4 py-3 text-sm leading-7 transition-colors whitespace-pre-wrap",
                          isActive
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-transparent text-muted-foreground",
                        ].join(" ")}
                      >
                        {line}
                      </p>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No transcript saved for this episode.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="research" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold">Research notes</h3>
              </div>
              <Separator />
              {episode.researchSources && episode.researchSources.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {episode.researchSources.map((source) => (
                    <Card key={source.url} className="p-4 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium leading-6 line-clamp-2">{source.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatSourceDate(source.publishedDate)}
                              {source.author ? ` by ${source.author}` : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={source.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground break-all">{source.url}</p>

                        {source.highlights.length > 0 ? (
                          <div className="space-y-2">
                            {source.highlights.slice(0, 3).map((highlight) => (
                              <p key={highlight} className="text-sm leading-6 text-foreground">
                                {highlight}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-muted-foreground">No excerpt returned.</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : episode.researchContext ? (
                <pre className="text-sm leading-7 whitespace-pre-wrap font-sans text-foreground">
                  {episode.researchContext}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No research context was stored for this episode.</p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AudioPlayer podcast={episode} onProgress={setPlaybackState} />
    </div>
  )
}
