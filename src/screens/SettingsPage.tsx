"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sparkles, ChevronLeft, Trash2 } from "lucide-react"
import { Link, useNavigate } from "@/lib/router"
import { useToast } from "@/hooks/use-toast"

export function SettingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    autoPlay: true,
    downloadQuality: "high",
    voiceType: "natural",
    playbackSpeed: 1.0,
    autoDownload: false,
    notifications: true,
    darkMode: true,
  })

  useEffect(() => {
    const savedSettings = localStorage.getItem("app_settings")
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem("app_settings", JSON.stringify(newSettings))
  }

  const handleResetOnboarding = () => {
    localStorage.removeItem("onboarding_completed")
    localStorage.removeItem("selected_topics")
    toast({
      title: "Onboarding reset",
      description: "You will be redirected to the onboarding flow",
    })
    setTimeout(() => {
      navigate("/")
    }, 1000)
  }

  const handleClearAllData = () => {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      localStorage.clear()
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
