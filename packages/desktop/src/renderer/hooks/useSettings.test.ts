import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useSettings, type UseSettingsResult } from "./useSettings.js";

// @ts-ignore Domino ships types for the legacy package name only.
import { createWindow } from "@mixmark-io/domino";

const defaultSettings = {
  version: 1,
  theme: "dark" as const,
  reducedMotion: false,
  shortcut: "CommandOrControl+Shift+J",
  autoStart: true,
  locale: "en-US",
  model: { provider: "ollama" as const, model: "llama3", baseUrl: "http://127.0.0.1:11434" },
};

const customSettings = {
  ...defaultSettings,
  theme: "light" as const,
  locale: "fr-FR",
};

const defaultProfile = { version: 1, userName: "User" };
const customProfile = { version: 1, userName: "Ada" };

function createApi(overrides = {}) {
  return {
    getSettings: vi.fn().mockResolvedValue(defaultSettings),
    setSettings: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue(defaultProfile),
    setProfile: vi.fn().mockResolvedValue(undefined),
    getEnvApiKeys: vi.fn().mockResolvedValue({ ollamaApiKey: null, openaiApiKey: null }),
    resetSettings: vi.fn().mockResolvedValue({
      ...defaultSettings,
      model: { provider: "ollama", model: "llama3", baseUrl: "http://127.0.0.1:11434" },
    }),
    ...overrides,
  };
}

type Api = ReturnType<typeof createApi>;

async function mountUseSettings(
  api?: Api,
): Promise<{ result: UseSettingsResult; flush: () => Promise<void> }> {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const win = createWindow() as any;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).Element = win.Element;
  (globalThis as any).Node = win.Node;
  win.electronAPI = api ?? undefined;

  let current: UseSettingsResult | undefined;
  function Wrapper() {
    current = useSettings();
    return null;
  }

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);

  const root = createRoot(container as any);
  await act(async () => {
    root.render(React.createElement(Wrapper));
  });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  if (current === undefined) throw new Error("Hook did not produce a result");

  return {
    get result() {
      if (current === undefined) throw new Error("Hook result lost");
      return current;
    },
    flush,
  };
}

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    (window as any).electronAPI = undefined;
  });

  it("loads settings and profile on mount", async () => {
    const api = createApi({
      getSettings: vi.fn().mockResolvedValue(customSettings),
      getProfile: vi.fn().mockResolvedValue(customProfile),
    });
    const { result, flush } = await mountUseSettings(api);
    await flush();
    expect(result.settings).toEqual(customSettings);
    expect(result.profile).toEqual(customProfile);
    expect(result.isLoading).toBe(false);
  });

  it("persists a setting update", async () => {
    const api = createApi();
    const { result, flush } = await mountUseSettings(api);
    await flush();

    await act(async () => {
      result.updateSetting("theme", "light");
    });
    await flush();

    expect(api.setSettings).toHaveBeenCalledTimes(1);
    expect(api.setSettings).toHaveBeenCalledWith({
      ...defaultSettings,
      theme: "light",
    });
  });

  it("persists a profile update", async () => {
    const api = createApi();
    const { result, flush } = await mountUseSettings(api);
    await flush();

    await act(async () => {
      result.updateProfile({ userName: "Ada" });
    });
    await flush();

    expect(api.setProfile).toHaveBeenCalledTimes(1);
    expect(api.setProfile).toHaveBeenCalledWith({
      ...defaultProfile,
      userName: "Ada",
    });
  });

  it("is ready immediately when the API is missing", async () => {
    (window as any).electronAPI = undefined;
    const { result, flush } = await mountUseSettings(undefined);
    await flush();
    // No fatal error — the hook just returns defaults and stays not-loading.
    expect(result.error).toBeNull();
    expect(result.isLoading).toBe(false);
  });

  it("resetSettings does not flash the local fallback before IPC resolves", async () => {
    // The hook used to optimistically setSettings(fallbackSettings) before
    // awaiting the IPC; this produced a one-frame flash of the local
    // fallback. Verify that the in-flight settings object is unchanged
    // while the IPC is pending, and only flips to the IPC result after it
    // resolves.
    const customDefault = {
      version: 1,
      theme: "light" as const,
      reducedMotion: false,
      shortcut: "Ctrl+Alt+J",
      autoStart: false,
      locale: "fr-FR",
    };
    let resolveReset: ((value: typeof customDefault) => void) | undefined;
    const resetPromise = new Promise<typeof customDefault>((r) => {
      resolveReset = r;
    });
    const api = createApi({
      resetSettings: vi.fn().mockReturnValue(resetPromise),
    });
    const mounted = await mountUseSettings(api);
    await mounted.flush();

    // Start reset, but do not let it resolve yet.
    await act(async () => {
      mounted.result.resetSettings();
    });
    await mounted.flush();

    // While the IPC is pending, settings must be the original (not the
    // local dark-theme fallback, not the IPC result yet).
    expect(mounted.result.settings.theme).toBe("dark");
    expect(mounted.result.settings.locale).toBe("en-US");

    // Now resolve the IPC and check the settings flip to the IPC result.
    await act(async () => {
      resolveReset?.(customDefault);
      await resetPromise;
    });
    await mounted.flush();

    expect(mounted.result.settings).toEqual(customDefault);
  });
});
