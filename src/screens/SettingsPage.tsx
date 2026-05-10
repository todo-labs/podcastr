"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, Trash2 } from "lucide-react"
import { Link, useNavigate } from "@/lib/router"
import { useToast } from "@/hooks/use-toast"
import {
  applyAppTheme,
  clearAllAppData,
  getAppSettings,
  getOnboardingState,
  resetOnboardingState,
  saveAppSettings,
  saveOnboardingState,
} from "@/lib/persistence"
import { ThemePicker } from "@/components/theme-picker"
import { cn } from "@/lib/utils"

function WaveformMark({ className }: { className?: string }) {
  const heights = [3, 5, 8, 11, 14, 11, 8, 5, 3]
  return (
    <div className={cn("flex items-center gap-[2px]", className)}>
      {heights.map((h, i) => (
        <div key={i} className="w-[3px] bg-primary rounded-[1px]" style={{ height: `${h}px` }} />
      ))}
    </div>
  )
}

function Section({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border p-6 space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary mb-1">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="border-t border-border pt-6 space-y-6">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    autoPlay: true,
    downloadQuality: "high",
    voiceType: "natural",
    defaultVoice: "alloy",
    scriptModel: "gpt-5.5",
    playbackSpeed: 1.0,
    autoDownload: false,
    notifications: true,
    darkMode: true,
    openaiApiKey: "",
    exaApiKey: "",
  })
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [apiKeyDraft, setApiKeyDraft] = useState("")
  const [exaApiKeyDraft, setExaApiKeyDraft] = useState("")

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [savedSettings, onboardingState] = await Promise.all([getAppSettings(), getOnboardingState()])
      if (!cancelled) {
        setSettings(savedSettings)
        setSelectedThemes(onboardingState.selectedThemes)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    if (key === "darkMode") {
      applyAppTheme(Boolean(value))
    }
    void saveAppSettings(newSettings)
  }

  const saveApiKey = () => {
    const nextSettings = {
      ...settings,
      openaiApiKey: apiKeyDraft.trim() || settings.openaiApiKey,
    }
    setSettings(nextSettings)
    setApiKeyDraft("")
    void saveAppSettings(nextSettings)
  }

  const clearApiKey = () => {
    const nextSettings = { ...settings, openaiApiKey: "" }
    setSettings(nextSettings)
    setApiKeyDraft("")
    void saveAppSettings(nextSettings)
  }

  const saveExaApiKey = () => {
    const nextSettings = {
      ...settings,
      exaApiKey: exaApiKeyDraft.trim() || settings.exaApiKey,
    }
    setSettings(nextSettings)
    setExaApiKeyDraft("")
    void saveAppSettings(nextSettings)
  }

  const clearExaApiKey = () => {
    const nextSettings = { ...settings, exaApiKey: "" }
    setSettings(nextSettings)
    setExaApiKeyDraft("")
    void saveAppSettings(nextSettings)
  }

  const updateThemes = (themes: string[]) => {
    setSelectedThemes(themes)
    void saveOnboardingState({ completed: true, selectedThemes: themes })
  }

  const handleResetOnboarding = async () => {
    await resetOnboardingState()
    toast({ title: "Onboarding reset", description: "You will be redirected to the onboarding flow" })
    setTimeout(() => navigate("/"), 1000)
  }

  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      await clearAllAppData()
      applyAppTheme(true)
      toast({ title: "All data cleared", description: "Redirecting to onboarding..." })
      setTimeout(() => navigate("/"), 1000)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="px-6 py-4 flex items-center gap-4 max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <WaveformMark />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-foreground">Settings</span>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto space-y-4">
        {/* Playback */}
        <Section label="Playback" description="Configure your listening experience">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Auto-play next episode</Label>
              <p className="text-xs text-muted-foreground">Automatically play the next podcast</p>
            </div>
            <Switch checked={settings.autoPlay} onCheckedChange={(v) => updateSetting("autoPlay", v)} />
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-foreground">
              Playback Speed:{" "}
              <span className="font-mono text-primary">{settings.playbackSpeed}x</span>
            </Label>
            <Slider
              value={[settings.playbackSpeed]}
              min={0.5}
              max={2}
              step={0.25}
              onValueChange={([v]) => updateSetting("playbackSpeed", v)}
            />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground tracking-widest">
              <span>0.5×</span>
              <span>1.0×</span>
              <span>2.0×</span>
            </div>
          </div>
        </Section>

        {/* AI Generation */}
        <Section label="AI Generation" description="Customize how podcasts are generated">
          {/* OpenAI key */}
          <div className="space-y-2">
            <Label htmlFor="openai-api-key" className="text-sm text-foreground">
              OpenAI API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-api-key"
                type="password"
                placeholder={settings.openaiApiKey ? "Key already configured" : "sk-..."}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                autoComplete="off"
                className="font-mono text-sm"
              />
              <Button onClick={saveApiKey} disabled={!apiKeyDraft.trim()} className="font-mono text-xs tracking-widest">
                SAVE
              </Button>
              <Button
                variant="outline"
                onClick={clearApiKey}
                disabled={!settings.openaiApiKey && !apiKeyDraft}
                className="font-mono text-xs tracking-widest"
              >
                CLEAR
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              {settings.openaiApiKey ? "Key configured — stored locally" : "No key saved yet"}
            </p>
          </div>

          {/* Exa key */}
          <div className="space-y-2">
            <Label htmlFor="exa-api-key" className="text-sm text-foreground">
              Exa API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="exa-api-key"
                type="password"
                placeholder={settings.exaApiKey ? "Key already configured" : "exa_..."}
                value={exaApiKeyDraft}
                onChange={(e) => setExaApiKeyDraft(e.target.value)}
                autoComplete="off"
                className="font-mono text-sm"
              />
              <Button
                onClick={saveExaApiKey}
                disabled={!exaApiKeyDraft.trim()}
                className="font-mono text-xs tracking-widest"
              >
                SAVE
              </Button>
              <Button
                variant="outline"
                onClick={clearExaApiKey}
                disabled={!settings.exaApiKey && !exaApiKeyDraft}
                className="font-mono text-xs tracking-widest"
              >
                CLEAR
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              {settings.exaApiKey
                ? "Key configured — web-grounded research enabled"
                : "No Exa key saved — episodes generate without web research"}
            </p>
          </div>

          {/* Voice type */}
          <div className="space-y-2">
            <Label htmlFor="voice-type" className="text-sm text-foreground">
              Voice Type
            </Label>
            <Select value={settings.voiceType} onValueChange={(v) => updateSetting("voiceType", v)}>
              <SelectTrigger id="voice-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">Natural & Conversational</SelectItem>
                <SelectItem value="professional">Professional & Clear</SelectItem>
                <SelectItem value="energetic">Energetic & Dynamic</SelectItem>
                <SelectItem value="calm">Calm & Soothing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Script model */}
          <div className="space-y-2">
            <Label htmlFor="script-model" className="text-sm text-foreground">
              Script Model
            </Label>
            <Select value={settings.scriptModel} onValueChange={(v) => updateSetting("scriptModel", v)}>
              <SelectTrigger id="script-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5.5">GPT-5.5 — best writing quality</SelectItem>
                <SelectItem value="gpt-5.4">GPT-5.4 — balanced quality</SelectItem>
                <SelectItem value="gpt-5">GPT-5 — legacy high quality</SelectItem>
                <SelectItem value="gpt-5-mini">GPT-5 mini — faster</SelectItem>
                <SelectItem value="gpt-5-nano">GPT-5 nano — cheapest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default voice */}
          <div className="space-y-2">
            <Label htmlFor="default-voice" className="text-sm text-foreground">
              Default Voice
            </Label>
            <Select value={settings.defaultVoice} onValueChange={(v) => updateSetting("defaultVoice", v)}>
              <SelectTrigger id="default-voice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "alloy", "ash", "ballad", "coral", "echo", "fable",
                  "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar",
                ].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generation quality */}
          <div className="space-y-2">
            <Label htmlFor="quality" className="text-sm text-foreground">
              Generation Quality
            </Label>
            <Select value={settings.downloadQuality} onValueChange={(v) => updateSetting("downloadQuality", v)}>
              <SelectTrigger id="quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High — best quality</SelectItem>
                <SelectItem value="medium">Medium — balanced</SelectItem>
                <SelectItem value="low">Low — faster generation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Auto-download generated podcasts</Label>
              <p className="text-xs text-muted-foreground">Save podcasts locally for offline access</p>
            </div>
            <Switch checked={settings.autoDownload} onCheckedChange={(v) => updateSetting("autoDownload", v)} />
          </div>
        </Section>

        {/* Themes */}
        <Section label="Frequencies" description="Topics used to drive research and script content">
          <ThemePicker selectedThemes={selectedThemes} onChange={updateThemes} />
        </Section>

        {/* Notifications */}
        <Section label="Notifications" description="Manage notification preferences">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Enable notifications</Label>
              <p className="text-xs text-muted-foreground">Get notified when new podcasts are ready</p>
            </div>
            <Switch checked={settings.notifications} onCheckedChange={(v) => updateSetting("notifications", v)} />
          </div>
        </Section>

        {/* Data management */}
        <Section label="Data Management" description="Manage your local data and preferences">
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start font-mono text-xs tracking-widest bg-transparent"
              onClick={handleResetOnboarding}
            >
              RESET ONBOARDING
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-2 font-mono text-xs tracking-widest"
              onClick={handleClearAllData}
            >
              <Trash2 className="w-4 h-4" />
              CLEAR ALL DATA
            </Button>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-4 space-y-1">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            Podcastr — Local-First AI Podcasting
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">v1.0.0 — all data stored on-device</p>
        </div>
      </main>
    </div>
  )
}
