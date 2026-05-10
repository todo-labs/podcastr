"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ThumbsUp, ThumbsDown, Meh } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  podcast: {
    id: string
    title: string
  }
  initialRating: "positive" | "negative" | null
  onFeedbackSubmitted: (rating: "positive" | "negative" | null) => void
}

export function FeedbackDialog({
  open,
  onOpenChange,
  podcast,
  initialRating,
  onFeedbackSubmitted,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<string>("")
  const [feedback, setFeedback] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    if (open && initialRating) {
      setRating(initialRating)
    }
  }, [open, initialRating])

  useEffect(() => {
    if (open && podcast?.id) {
      const allFeedback = JSON.parse(localStorage.getItem("podcast_feedback") || "[]")
      const thisPodcastFeedback = allFeedback.find((f: any) => f.podcastId === podcast.id)
      if (thisPodcastFeedback) {
        setRating(thisPodcastFeedback.rating)
        setFeedback(thisPodcastFeedback.feedback || "")
      }
    }
  }, [open, podcast?.id])

  const handleSubmit = () => {
    if (!rating) {
      toast({
        title: "Rating required",
        description: "Please select a rating before submitting",
        variant: "destructive",
      })
      return
    }

    if (!podcast?.id) return

    const existingFeedback = JSON.parse(localStorage.getItem("podcast_feedback") || "[]")
    const filteredFeedback = existingFeedback.filter((f: any) => f.podcastId !== podcast.id)

    filteredFeedback.push({
      podcastId: podcast.id,
      podcastTitle: podcast.title,
      rating,
      feedback,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("podcast_feedback", JSON.stringify(filteredFeedback))

    onFeedbackSubmitted(rating === "positive" ? "positive" : rating === "negative" ? "negative" : null)

    toast({
      title: "Thank you for your feedback!",
      description: "Your input helps improve our AI podcast generation",
    })

    setRating("")
    setFeedback("")
    onOpenChange(false)
  }

  if (!podcast?.id) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            How was "{podcast.title}"? Your feedback helps improve our AI podcast generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>How was the podcast quality?</Label>
            <RadioGroup value={rating} onValueChange={setRating}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="positive" id="positive" />
                <Label htmlFor="positive" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ThumbsUp className="w-5 h-5 text-green-500" />
                  <span>Great - Very informative and engaging</span>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="neutral" id="neutral" />
                <Label htmlFor="neutral" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Meh className="w-5 h-5 text-yellow-500" />
                  <span>Good - Could use some improvements</span>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="negative" id="negative" />
                <Label htmlFor="negative" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ThumbsDown className="w-5 h-5 text-red-500" />
                  <span>Needs Work - Not what I expected</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Comments (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Share specific details about what you liked or what could be improved..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit Feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
