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
    ...overrides,
  };
}

type Api = ReturnType<typeof createApi>;

async function mountUseSettings(
  api?: Api
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

  it("sets an error when the API is missing", async () => {
    (window as any).electronAPI = undefined;
    const { result, flush } = await mountUseSettings(undefined);
    await flush();
    expect(result.error).toBe("Electron API not available");
    expect(result.isLoading).toBe(false);
  });
});
