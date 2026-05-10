import { useEffect } from "react"
import { Toaster } from "@/components/ui/toaster"
import { usePathname } from "@/lib/router"
import { applyAppTheme, getAppSettings } from "@/lib/persistence"
import { EpisodePage } from "./screens/EpisodePage"
import { RootPage } from "./screens/RootPage"
import { SettingsPage } from "./screens/SettingsPage"

export default function App() {
  const pathname = usePathname()
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "")
  const episodeMatch = normalizedPath.match(/^\/episode\/([^/]+)$/)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const settings = await getAppSettings()
      if (!cancelled) {
        applyAppTheme(settings.darkMode)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {normalizedPath === "/settings" ? (
        <SettingsPage />
      ) : episodeMatch ? (
        <EpisodePage episodeId={decodeURIComponent(episodeMatch[1])} />
      ) : (
        <RootPage />
      )}
      <Toaster />
    </>
  )
}
