"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sparkles, ChevronLeft, Trash2 } from "lucide-react"
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
      const [savedSettings, onboardingState] = await Promise.all([
        getAppSettings(),
        getOnboardingState(),
      ])
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
    const nextSettings = {
      ...settings,
      openaiApiKey: "",
    }

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
    const nextSettings = {
      ...settings,
      exaApiKey: "",
    }

    setSettings(nextSettings)
    setExaApiKeyDraft("")
    void saveAppSettings(nextSettings)
  }

  const updateThemes = (themes: string[]) => {
    setSelectedThemes(themes)
    void saveOnboardingState({
      completed: true,
      selectedThemes: themes,
    })
  }

  const handleResetOnboarding = async () => {
    await resetOnboardingState()
    toast({
      title: "Onboarding reset",
      description: "You will be redirected to the onboarding flow",
    })
    setTimeout(() => {
      navigate("/")
    }, 1000)
  }

  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      await clearAllAppData()
      applyAppTheme(true)
      toast({
        title: "All data cleared",
        description: "Redirecting to onboarding...",
      })
      setTimeout(() => {
        navigate("/")
      }, 1000)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">Settings</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Playback</h2>
            <p className="text-sm text-muted-foreground">Configure your listening experience</p>
          </div>

          <Separator />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-play next episode</Label>
                <p className="text-sm text-muted-foreground">Automatically play the next podcast</p>
              </div>
              <Switch checked={settings.autoPlay} onCheckedChange={(checked) => updateSetting("autoPlay", checked)} />
            </div>

            <div className="space-y-3">
              <Label>Playback Speed: {settings.playbackSpeed}x</Label>
              <Slider
                value={[settings.playbackSpeed]}
                min={0.5}
                max={2}
                step={0.25}
                onValueChange={([value]) => updateSetting("playbackSpeed", value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">AI Generation</h2>
            <p className="text-sm text-muted-foreground">Customize how podcasts are generated</p>
          </div>

          <Separator />

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">OpenAI API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-api-key"
                  type="password"
                  placeholder={settings.openaiApiKey ? "Key already configured" : "sk-..."}
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  autoComplete="off"
                />
                <Button onClick={saveApiKey} disabled={!apiKeyDraft.trim()}>
                  Save
                </Button>
                <Button variant="outline" onClick={clearApiKey} disabled={!settings.openaiApiKey && !apiKeyDraft}>
                  Clear
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {settings.openaiApiKey ? "A key is configured locally for OpenAI requests." : "No API key is saved yet."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exa-api-key">Exa API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="exa-api-key"
                  type="password"
                  placeholder={settings.exaApiKey ? "Key already configured" : "exa_..."}
                  value={exaApiKeyDraft}
                  onChange={(event) => setExaApiKeyDraft(event.target.value)}
                  autoComplete="off"
                />
                <Button onClick={saveExaApiKey} disabled={!exaApiKeyDraft.trim()}>
                  Save
                </Button>
                <Button variant="outline" onClick={clearExaApiKey} disabled={!settings.exaApiKey && !exaApiKeyDraft}>
                  Clear
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {settings.exaApiKey
                  ? "A key is configured locally for web-grounded podcast research."
                  : "No Exa key is saved yet. Episodes will generate without web research."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-type">Voice Type</Label>
              <Select value={settings.voiceType} onValueChange={(value) => updateSetting("voiceType", value)}>
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

            <div className="space-y-2">
              <Label htmlFor="script-model">Script Model</Label>
              <Select value={settings.scriptModel} onValueChange={(value) => updateSetting("scriptModel", value)}>
                <SelectTrigger id="script-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5.5">GPT-5.5 - best writing quality</SelectItem>
                  <SelectItem value="gpt-5.4">GPT-5.4 - balanced quality</SelectItem>
                  <SelectItem value="gpt-5">GPT-5 - legacy high quality</SelectItem>
                  <SelectItem value="gpt-5-mini">GPT-5 mini - faster</SelectItem>
                  <SelectItem value="gpt-5-nano">GPT-5 nano - cheapest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-voice">Default Voice</Label>
              <Select value={settings.defaultVoice} onValueChange={(value) => updateSetting("defaultVoice", value)}>
                <SelectTrigger id="default-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="ash">Ash</SelectItem>
                  <SelectItem value="ballad">Ballad</SelectItem>
                  <SelectItem value="coral">Coral</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="sage">Sage</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                  <SelectItem value="verse">Verse</SelectItem>
                  <SelectItem value="marin">Marin</SelectItem>
                  <SelectItem value="cedar">Cedar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality">Generation Quality</Label>
              <Select
                value={settings.downloadQuality}
                onValueChange={(value) => updateSetting("downloadQuality", value)}
              >
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High - Best quality</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="low">Low - Faster generation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-download generated podcasts</Label>
                <p className="text-sm text-muted-foreground">Save podcasts locally for offline access</p>
              </div>
              <Switch
                checked={settings.autoDownload}
                onCheckedChange={(checked) => updateSetting("autoDownload", checked)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Themes</h2>
            <p className="text-sm text-muted-foreground">Update the themes used to personalize your feed</p>
          </div>

          <Separator />

          <ThemePicker selectedThemes={selectedThemes} onChange={updateThemes} />
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Appearance</h2>
            <p className="text-sm text-muted-foreground">Customize the app appearance</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Use dark theme throughout the app</p>
            </div>
            <Switch checked={settings.darkMode} onCheckedChange={(checked) => updateSetting("darkMode", checked)} />
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Notifications</h2>
            <p className="text-sm text-muted-foreground">Manage notification preferences</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable notifications</Label>
              <p className="text-sm text-muted-foreground">Get notified when new podcasts are ready</p>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={(checked) => updateSetting("notifications", checked)}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Data Management</h2>
            <p className="text-sm text-muted-foreground">Manage your local data and preferences</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleResetOnboarding}>
              Reset Onboarding
            </Button>

            <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleClearAllData}>
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2 text-sm text-muted-foreground text-center">
            <p>Podcastr - Local-First AI Podcasting</p>
            <p>Version 1.0.0</p>
            <p className="text-xs">All data is stored locally on your device</p>
          </div>
        </Card>
      </main>
    </div>
  )
}
