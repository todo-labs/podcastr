import { useState, useEffect } from "react"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { HomeScreen } from "@/components/home-screen"

export function RootPage() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem("onboarding_completed")
    if (completed === "true") {
      setHasCompletedOnboarding(true)
    }
  }, [])

  const handleOnboardingComplete = (selectedTopics: string[]) => {
    localStorage.setItem("onboarding_completed", "true")
    localStorage.setItem("selected_topics", JSON.stringify(selectedTopics))
    setHasCompletedOnboarding(true)
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />
  }

  return <HomeScreen />
}
