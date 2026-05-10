"use client"

import { Card } from "@/components/ui/card"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { PODCAST_THEMES, type PodcastThemeId } from "@/lib/themes"

interface ThemePickerProps {
  selectedThemes: string[]
  onChange: (themes: string[]) => void
  minSelected?: number
  className?: string
}

export function ThemePicker({ selectedThemes, onChange, minSelected = 3, className }: ThemePickerProps) {
  const toggleTheme = (themeId: PodcastThemeId) => {
    onChange(
      selectedThemes.includes(themeId)
        ? selectedThemes.filter((id) => id !== themeId)
        : [...selectedThemes, themeId],
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {PODCAST_THEMES.map((theme) => {
          const isSelected = selectedThemes.includes(theme.id)

          return (
            <Card
              key={theme.id}
              className={cn(
                "relative p-4 md:p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
                isSelected && "ring-2 ring-primary bg-primary/5",
              )}
              onClick={() => toggleTheme(theme.id)}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="text-3xl md:text-4xl">{theme.icon}</div>
                <span className="font-medium text-sm leading-tight">{theme.label}</span>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Select at least {minSelected} themes to personalize your feed
      </p>
    </div>
  )
}
