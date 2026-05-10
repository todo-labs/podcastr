"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import { ThemePicker } from "@/components/theme-picker"
import { cn } from "@/lib/utils"

interface OnboardingFlowProps {
  onComplete: (selectedThemes: string[]) => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])

  const handleContinue = () => {
    if (step === 2 && selectedThemes.length > 0) {
      onComplete(selectedThemes)
    } else {
      setStep(2)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Podcastr</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("w-2 h-2 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        {step === 1 ? (
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight text-balance">Welcome to AI-Powered Podcasting</h1>
              <p className="text-xl text-muted-foreground text-pretty leading-relaxed">
                Create personalized podcasts on any topic with the power of AI. Your audio content, generated locally on
                your device.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
              <Card className="p-6 text-center space-y-2">
                <div className="text-4xl mb-2">🎙️</div>
                <h3 className="font-semibold">AI Generation</h3>
                <p className="text-sm text-muted-foreground">Advanced AI creates engaging podcast content</p>
              </Card>
              <Card className="p-6 text-center space-y-2">
                <div className="text-4xl mb-2">💾</div>
                <h3 className="font-semibold">Local First</h3>
                <p className="text-sm text-muted-foreground">All your data stays on your device</p>
              </Card>
              <Card className="p-6 text-center space-y-2">
                <div className="text-4xl mb-2">⚡</div>
                <h3 className="font-semibold">Instant Access</h3>
                <p className="text-sm text-muted-foreground">Listen anytime, anywhere, offline</p>
              </Card>
            </div>

            <Button size="lg" onClick={handleContinue} className="px-8">
              Get Started
            </Button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-bold tracking-tight">Choose Your Themes</h1>
              <p className="text-lg text-muted-foreground">Select at least 3 themes to personalize your podcast feed</p>
            </div>

            <ThemePicker selectedThemes={selectedThemes} onChange={setSelectedThemes} />

            <div className="flex items-center justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => setStep(1)} size="lg">
                Back
              </Button>
              <Button onClick={handleContinue} disabled={selectedThemes.length < 3} size="lg" className="px-8">
                Continue ({selectedThemes.length} selected)
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
