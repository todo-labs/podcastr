"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  X,
  Mic,
} from "lucide-react"
import { FeedbackDialog } from "./feedback-dialog"
import { getPodcastFeedback } from "@/lib/persistence"
import { convertFileSrc } from "@tauri-apps/api/core"
import { cn } from "@/lib/utils"
import { toImageUrl } from "@/lib/openai"

interface Podcast {
  id: string
  title: string
  description: string
  duration: string
  imageUrl?: string
  imagePath?: string
  audioPath?: string
  audioUrl?: string
}

interface AudioPlayerProps {
  podcast: Podcast
  onProgress?: (progress: { currentTime: number; duration: number; isPlaying: boolean }) => void
}

/* ─── Waveform seek bar ─────────────────────────────────────────── */
function WaveformSeek({
  value,
  max,
  isPlaying,
  onChange,
}: {
  value: number
  max: number
  isPlaying: boolean
  onChange: (val: number) => void
}) {
  const bars = 64
  const progress = value / Math.max(1, max)
  const progressIndex = Math.floor(progress * bars)

  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const h =
          0.45 +
          Math.sin(i * 0.31) * 0.28 +
          Math.cos(i * 0.71) * 0.18 +
          Math.sin(i * 1.15) * 0.10
        return Math.max(0.08, Math.min(1, h))
      }),
    [],
  )

  return (
    <div className="relative group">
      <div className="flex items-center gap-[2px] h-8 cursor-pointer select-none">
        {heights.map((h, i) => {
          const isPast = i < progressIndex
          const isNear = Math.abs(i - progressIndex) < 3

          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors"
              style={{
                height: `${h * 100}%`,
                backgroundColor: isPast
                  ? "oklch(0.73 0.17 67)"
                  : isNear
                    ? "oklch(0.73 0.17 67 / 0.4)"
                    : "oklch(0.22 0.008 52)",
                transformOrigin: "center",
                animation:
                  isPlaying && isPast
                    ? `waveBar ${500 + ((i * 73) % 400)}ms ease-in-out ${(i * 41) % 400}ms infinite alternate`
                    : "none",
              }}
            />
          )
        })}
      </div>
      {/* Invisible range input for accessibility and interaction */}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        aria-label="Seek"
      />
    </div>
  )
}

/* ─── Volume bar ────────────────────────────────────────────────── */
function VolumeBar({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const bars = 16
  const filled = Math.round((value / 100) * bars)

  return (
    <div className="relative group flex items-center">
      <div className="flex items-center gap-[2px] h-4 w-16 cursor-pointer">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors"
            style={{
              height: `${30 + (i / bars) * 70}%`,
              backgroundColor: i < filled ? "oklch(0.73 0.17 67)" : "oklch(0.22 0.008 52)",
            }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        aria-label="Volume"
      />
    </div>
  )
}

/* ─── Audio player ──────────────────────────────────────────────── */
export function AudioPlayer({ podcast, onProgress }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(180)
  const [volume, setVolume] = useState(75)
  const [isMuted, setIsMuted] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<"positive" | "negative" | null>(null)
  const [episodeFeedback, setEpisodeFeedback] = useState<"positive" | "negative" | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioSource = podcast.audioPath ? convertFileSrc(podcast.audioPath) : podcast.audioUrl
  const hasAudioSource = Boolean(audioSource)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const thisPodcastFeedback = await getPodcastFeedback(podcast.id)
      if (!cancelled) {
        setEpisodeFeedback(
          thisPodcastFeedback?.rating === "positive"
            ? "positive"
            : thisPodcastFeedback?.rating === "negative"
              ? "negative"
              : null,
        )
      }
    })()
    return () => { cancelled = true }
  }, [podcast.id])

  useEffect(() => {
    setCurrentTime(0)
    setIsPlaying(false)
    if (!hasAudioSource) setDuration(180)
  }, [podcast.id, hasAudioSource])

  useEffect(() => {
    if (!hasAudioSource) return

    const audio = new Audio(audioSource)
    audioRef.current = audio
    audio.preload = "metadata"
    audio.volume = volume / 100
    audio.muted = isMuted

    const handleLoadedMetadata = () => {
      setDuration(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.max(1, Math.round(audio.duration))
          : 180,
      )
    }
    const handleTimeUpdate = () => setCurrentTime(Math.floor(audio.currentTime))
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0) }
    const handleVolumeChange = () => {
      setVolume(Math.round(audio.volume * 100))
      setIsMuted(audio.muted || audio.volume === 0)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("volumechange", handleVolumeChange)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)

    return () => {
      audio.pause()
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("volumechange", handleVolumeChange)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [audioSource, hasAudioSource])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
      audioRef.current.muted = isMuted
    }
  }, [volume, isMuted])

  useEffect(() => {
    onProgress?.({ currentTime, duration, isPlaying })
  }, [currentTime, duration, isPlaying, onProgress])

  useEffect(() => {
    if (hasAudioSource) return
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) { setIsPlaying(false); return 0 }
          return prev + 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [hasAudioSource, isPlaying, duration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePlayPause = async () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        try { await audioRef.current.play() } catch { setIsPlaying(false) }
      } else {
        audioRef.current.pause()
      }
      return
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val
      setCurrentTime(val)
      return
    }
    setCurrentTime(val)
  }

  const handleVolumeChange = (val: number) => {
    setVolume(val)
    setIsMuted(false)
    if (audioRef.current) {
      audioRef.current.volume = val / 100
      audioRef.current.muted = false
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) audioRef.current.muted = !isMuted
  }

  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 15, duration)
      return
    }
    setCurrentTime(Math.min(currentTime + 15, duration))
  }

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 15, 0)
      return
    }
    setCurrentTime(Math.max(currentTime - 15, 0))
  }

  const handleFeedbackClick = (type: "positive" | "negative") => {
    setFeedbackType(type)
    setFeedbackOpen(true)
  }

  const coverSrc = podcast.imagePath
    ? convertFileSrc(podcast.imagePath)
    : podcast.imageUrl || null

  /* ── Minimized bar ── */
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="container mx-auto px-5 py-2.5 flex items-center gap-4">
          {coverSrc ? (
            <img src={coverSrc} alt={podcast.title} className="w-8 h-8 rounded-sm object-cover shrink-0 border border-border" />
          ) : (
            <div className="w-8 h-8 rounded-sm bg-muted border border-border flex items-center justify-center shrink-0">
              <Mic className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}
          <p className="flex-1 text-xs truncate">{podcast.title}</p>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handlePlayPause}>
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsMinimized(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  /* ── Full player ── */
  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        {/* Waveform seek bar — the signature element */}
        <div className="px-5 pt-3 pb-0">
          <WaveformSeek value={currentTime} max={duration} isPlaying={isPlaying} onChange={handleSeek} />
          <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls row */}
        <div className="px-5 py-3 flex items-center gap-5">
          {/* Episode info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={podcast.title}
                className="w-8 h-8 rounded-sm object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-sm bg-muted border border-border flex items-center justify-center shrink-0">
                <Mic className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs truncate">{podcast.title}</p>
              <p className="text-[10px] text-muted-foreground">AI Generated</p>
            </div>
          </div>

          {/* Playback controls — centered */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSkipBack} title="Back 15s">
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSkipForward} title="Forward 15s">
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Right — volume + feedback + close */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </Button>
            <VolumeBar value={isMuted ? 0 : volume} onChange={handleVolumeChange} />

            <div className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", episodeFeedback === "positive" && "text-primary")}
              onClick={() => handleFeedbackClick("positive")}
            >
              <ThumbsUp className={cn("w-3.5 h-3.5", episodeFeedback === "positive" && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", episodeFeedback === "negative" && "text-destructive")}
              onClick={() => handleFeedbackClick("negative")}
            >
              <ThumbsDown className={cn("w-3.5 h-3.5", episodeFeedback === "negative" && "fill-current")} />
            </Button>

            <div className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(true)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        podcast={podcast}
        initialRating={feedbackType}
        onFeedbackSubmitted={setEpisodeFeedback}
      />
    </>
  )
}
