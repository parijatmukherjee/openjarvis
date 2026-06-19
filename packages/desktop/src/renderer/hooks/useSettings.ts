import { useCallback, useEffect, useState } from "react";
import type { AppSettings, UserProfile } from "../../main/schemas.js";

const fallbackSettings: AppSettings = {
  version: 1,
  theme: "dark",
  reducedMotion: false,
  shortcut: "CommandOrControl+Shift+J",
  autoStart: true,
  locale: "en-US",
  model: { provider: "ollama", model: "llama3", baseUrl: "http://127.0.0.1:11434" },
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
  resetSettings: () => void;
}

export function useSettings(): UseSettingsResult {
  const api = window.electronAPI;
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      setIsLoading(false);
      return;
    }
    Promise.all([api.getSettings(), api.getProfile(), api.getEnvApiKeys()])
      .then(([s, p, envKeys]) => {
        if (!s.model.apiKey) {
          const envKey = s.model.provider === "ollama-cloud"
            ? envKeys.ollamaApiKey
            : s.model.provider === "openai-compat"
              ? envKeys.openaiApiKey
              : envKeys.ollamaApiKey;
          if (envKey) {
            s.model.apiKey = envKey;
          }
        }
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
      const current = settings ?? fallbackSettings;
      const next = { ...current, [key]: value };
      setSettings(next);
      if (api) {
        api
          .setSettings(next)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }
    },
    [api, settings],
  );

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      const current = profile ?? fallbackProfile;
      const next = { ...current, ...patch };
      setProfile(next);
      if (api) {
        api
          .setProfile(next)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }
    },
    [api, profile],
  );

  const resetSettings = useCallback(() => {
    setSettings(fallbackSettings);
    if (api) {
      api
        .resetSettings()
        .then((defaults) => setSettings(defaults))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }
  }, [api]);

  return {
    settings: settings ?? fallbackSettings,
    profile: profile ?? fallbackProfile,
    isLoading,
    error,
    updateSetting,
    updateProfile,
    resetSettings,
  };
}
