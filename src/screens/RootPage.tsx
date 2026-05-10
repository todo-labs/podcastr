import { useState, useEffect } from "react"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { HomeScreen } from "@/components/home-screen"
import { getOnboardingState, saveOnboardingState } from "@/lib/persistence"

export function RootPage() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const state = await getOnboardingState()
      if (!cancelled) {
        setHasCompletedOnboarding(state.completed)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleOnboardingComplete = async (selectedThemes: string[]) => {
    await saveOnboardingState({ completed: true, selectedThemes })
    setHasCompletedOnboarding(true)
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />
  }

  return <HomeScreen />
}
