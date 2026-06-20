import { useState } from "react";
import { NexusProvider } from "./contexts/NexusContext";
import { SettingsProvider } from "./context/SettingsContext";
import { createIpcNexusBridge } from "./lib/ipc-nexus-bridge";
import type { NexusBridge } from "./lib/nexus-types";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { SettingsPanel } from "./components/SettingsPanel";

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("onboardingComplete") !== "true";
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboardingComplete", "true");
    setShowOnboarding(false);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      {showOnboarding ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <DashboardLayout onSettings={() => setShowSettings(true)} />
      )}
    </div>
  );
}

export function App() {
  const bridge = useState<NexusBridge>(() => {
    if (window.electronAPI?.nexusExecuteIntent) {
      return createIpcNexusBridge();
    }
    throw new Error(
      "No NexusBridge available. This app must run inside Electron with the preload script loaded.",
    );
  })[0];

  return (
    <SettingsProvider>
      <NexusProvider value={bridge}>
        <AppContent />
      </NexusProvider>
    </SettingsProvider>
  );
}
