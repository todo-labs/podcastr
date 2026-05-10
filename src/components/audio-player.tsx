"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react"
import { FeedbackDialog } from "./feedback-dialog"

interface Podcast {
  id: string
  title: string
  description: string
  duration: string
  imageUrl?: string
}

interface AudioPlayerProps {
  podcast: Podcast
}

export function AudioPlayer({ podcast }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(180) // Mock duration in seconds
  const [volume, setVolume] = useState(75)
  const [isMuted, setIsMuted] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<"positive" | "negative" | null>(null)
  const [episodeFeedback, setEpisodeFeedback] = useState<"positive" | "negative" | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const allFeedback = JSON.parse(localStorage.getItem("podcast_feedback") || "[]")
    const thisPodcastFeedback = allFeedback.find((f: any) => f.podcastId === podcast.id)
    if (thisPodcastFeedback) {
      setEpisodeFeedback(
        thisPodcastFeedback.rating === "positive"
          ? "positive"
          : thisPodcastFeedback.rating === "negative"
            ? "negative"
            : null,
      )
    }
  }, [podcast.id])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false)
            return 0
          }
          return prev + 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, duration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
    setIsMuted(false)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleSkipForward = () => {
    setCurrentTime(Math.min(currentTime + 15, duration))
  }

  const handleSkipBack = () => {
    setCurrentTime(Math.max(currentTime - 15, 0))
  }

  const handleFeedbackClick = (type: "positive" | "negative") => {
    setFeedbackType(type)
    setFeedbackOpen(true)
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={podcast.imageUrl || "/placeholder.svg"}
                alt={podcast.title}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{podcast.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handlePlayPause}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsMinimized(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl z-50">
        <div className="container mx-auto px-4 py-6">
          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <Slider
              value={[currentTime]}
              max={duration}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Left: Podcast Info */}
            <div className="flex items-center gap-3">
              <img
                src={podcast.imageUrl || "/placeholder.svg"}
                alt={podcast.title}
                className="w-16 h-16 rounded-lg object-cover shadow-md"
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{podcast.title}</p>
                <p className="text-xs text-muted-foreground truncate">AI Generated Podcast</p>
              </div>
            </div>

            {/* Center: Controls */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Shuffle className="w-4 h-4" />
                </Button>

                <Button variant="ghost" size="icon" onClick={handleSkipBack} className="h-9 w-9">
                  <SkipBack className="w-5 h-5" />
                </Button>

                <Button size="icon" onClick={handlePlayPause} className="h-12 w-12 rounded-full">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                </Button>

                <Button variant="ghost" size="icon" onClick={handleSkipForward} className="h-9 w-9">
                  <SkipForward className="w-5 h-5" />
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Repeat className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Right: Volume & Feedback */}
            <div className="flex items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${episodeFeedback === "positive" ? "text-green-500" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => handleFeedbackClick("positive")}
                >
                  <ThumbsUp className={`w-4 h-4 ${episodeFeedback === "positive" ? "fill-current" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${episodeFeedback === "negative" ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => handleFeedbackClick("negative")}
                >
                  <ThumbsDown className={`w-4 h-4 ${episodeFeedback === "negative" ? "fill-current" : ""}`} />
                </Button>
              </div>

              <div className="flex items-center gap-2 min-w-[140px]">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Dialog */}
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
