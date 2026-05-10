"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThemePicker } from "@/components/theme-picker"
import { cn } from "@/lib/utils"

interface OnboardingFlowProps {
  onComplete: (selectedThemes: string[]) => void
}

function WaveformMark({ className }: { className?: string }) {
  const heights = [3, 5, 8, 11, 14, 11, 8, 5, 3]
  return (
    <div className={cn("flex items-center gap-[2px]", className)}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] bg-primary rounded-[1px]"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

function WaveformHero() {
  const bars = Array.from({ length: 40 }, (_, i) => i)
  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {bars.map((i) => (
        <div
          key={i}
          className="w-[4px] bg-primary rounded-[1px]"
          style={{
            animation: `waveBar ${0.8 + (i % 7) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.05) % 0.7}s`,
            opacity: 0.5 + (i % 3) * 0.2,
          }}
        />
      ))}
    </div>
  )
}

const FEATURES = [
  {
    code: "AI",
    label: "Neural script generation",
    description: "GPT-powered writing shaped by your selected topics and web research",
  },
  {
    code: "LOCAL",
    label: "Runs entirely on-device",
    description: "No cloud dependency. Your episodes, your data, your machine.",
  },
  {
    code: "TTS",
    label: "Studio-grade voice synthesis",
    description: "OpenAI TTS voices rendered locally to disk — ready to play instantly",
  },
]

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])

  const handleContinue = () => {
    if (step === 2 && selectedThemes.length >= 3) {
      onComplete(selectedThemes)
    } else {
      setStep(2)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WaveformMark />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-foreground">Podcastr</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          STEP {step} OF 2
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {step === 1 ? (
          <div className="max-w-lg w-full space-y-12">
            {/* Hero */}
            <div className="space-y-6 text-center">
              <WaveformHero />
              <div className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Local-first AI podcasting
                </p>
                <h1 className="text-4xl font-bold tracking-tight leading-tight text-foreground">
                  Your studio.<br />Your signal.
                </h1>
              </div>
            </div>

            {/* Feature table */}
            <div className="border border-border divide-y divide-border">
              {FEATURES.map((f) => (
                <div key={f.code} className="flex items-start gap-6 px-5 py-4">
                  <span className="font-mono text-[10px] text-primary tracking-widest mt-0.5 w-10 shrink-0 uppercase">
                    {f.code}
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-mono text-sm text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button onClick={handleContinue} size="lg" className="font-mono tracking-widest px-8">
                ENTER STUDIO →
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl w-full space-y-8">
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                Step 2 of 2
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Select your frequencies</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose at least 3 topics. These drive what content gets researched and scripted for you.
              </p>
            </div>

            <ThemePicker selectedThemes={selectedThemes} onChange={setSelectedThemes} />

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="font-mono tracking-widest text-xs"
              >
                ← BACK
              </Button>
              <Button
                onClick={handleContinue}
                disabled={selectedThemes.length < 3}
                className="font-mono tracking-widest text-xs px-6"
              >
                LAUNCH ({selectedThemes.length} selected)
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
