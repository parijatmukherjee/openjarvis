import { useCallback, useEffect, useState } from "react";
import type { AppSettings, UserProfile } from "../../main/schemas.js";

const fallbackSettings: AppSettings = {
  version: 1,
  theme: "dark",
  reducedMotion: false,
  shortcut: "CommandOrControl+Shift+J",
  autoStart: true,
  locale: "en-US",
};

const fallbackProfile: UserProfile = {
  version: 1,
  userName: "User",
};

export interface UseSettingsResult {
  settings: AppSettings;
  profile: UserProfile;
  isLoading: boolean;
  error: string | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
}

export function useSettings(): UseSettingsResult {
  const api = window.electronAPI;
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      setError("Electron API not available");
      setIsLoading(false);
      return;
    }
    Promise.all([api.getSettings(), api.getProfile()])
      .then(([s, p]) => {
        setSettings(s);
        setProfile(p);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, [api]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (!api || !settings) return;
      const next = { ...settings, [key]: value };
      setSettings(next);
      api.setSettings(next).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    },
    [api, settings]
  );

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      if (!api || !profile) return;
      const next = { ...profile, ...patch };
      setProfile(next);
      api.setProfile(next).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    },
    [api, profile]
  );

  return {
    settings: settings ?? fallbackSettings,
    profile: profile ?? fallbackProfile,
    isLoading,
    error,
    updateSetting,
    updateProfile,
  };
}
