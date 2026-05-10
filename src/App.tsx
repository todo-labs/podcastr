import { Toaster } from "@/components/ui/toaster"
import { usePathname } from "@/lib/router"
import { RootPage } from "./screens/RootPage"
import { SettingsPage } from "./screens/SettingsPage"

export default function App() {
  const pathname = usePathname()
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "")

  return (
    <>
      {normalizedPath === "/settings" ? <SettingsPage /> : <RootPage />}
      <Toaster />
    </>
  )
}
