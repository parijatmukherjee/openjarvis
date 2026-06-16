import { createContext, useContext, type ReactNode } from "react";
import { useSettings, type UseSettingsResult } from "../hooks/useSettings.js";

const SettingsContext = createContext<UseSettingsResult | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const value = useSettings();
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): UseSettingsResult {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
