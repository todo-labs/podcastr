import { useEffect } from "react"
import { Toaster } from "@/components/ui/toaster"
import { usePathname } from "@/lib/router"
import { applyAppTheme, getAppSettings } from "@/lib/persistence"
import { RootPage } from "./screens/RootPage"
import { SettingsPage } from "./screens/SettingsPage"

export default function App() {
  const pathname = usePathname()
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "")

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
      {normalizedPath === "/settings" ? <SettingsPage /> : <RootPage />}
      <Toaster />
    </>
  )
}
