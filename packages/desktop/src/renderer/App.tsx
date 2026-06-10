import { useState } from "react";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { WindowControls } from "./components/WindowControls";

export function App() {
  const [showOnboarding, setShowOnboarding] = useState(true);

  return (
    <div className="relative">
      <WindowControls />
      {showOnboarding ? (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      ) : (
        <DashboardLayout />
      )}
    </div>
  );
}
