"use client"

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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {PODCAST_THEMES.map((theme) => {
          const isSelected = selectedThemes.includes(theme.id)

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => toggleTheme(theme.id)}
              className={cn(
                "relative p-4 border text-left transition-colors cursor-pointer",
                "flex flex-col items-center gap-2 text-center",
                isSelected
                  ? "border-primary text-foreground bg-primary/5"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xl leading-none">{theme.icon}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest leading-tight">{theme.label}</span>
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="font-mono text-[10px] text-muted-foreground text-center uppercase tracking-widest">
        Select at least {minSelected} frequencies to personalize your feed
      </p>
    </div>
  )
}
