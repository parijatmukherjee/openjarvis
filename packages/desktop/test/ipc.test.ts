import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerIpcHandlers } from "../src/main/ipc.js";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  }),
};

const mockStore = {
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
};

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerIpcHandlers(mockStore as unknown as Parameters<typeof registerIpcHandlers>[0], ipcMain);
  });

  it("registers settings and profile handlers", () => {
    expect(ipcMain.handle).toHaveBeenCalledWith("settings:load", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("settings:save", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("profile:load", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("profile:save", expect.any(Function));
  });

  it("delegates settings:load to the store", async () => {
    const settings = { version: 1, theme: "dark" as const, reducedMotion: false, shortcut: "Cmd+J", autoStart: true, locale: "en-US" };
    mockStore.loadSettings.mockResolvedValue(settings);
    const handler = handlers.get("settings:load")!;
    expect(await handler()).toEqual(settings);
  });

  it("delegates settings:save to the store", async () => {
    const settings = { version: 1, theme: "light" as const, reducedMotion: true, shortcut: "Alt+J", autoStart: false, locale: "fr-FR" };
    const handler = handlers.get("settings:save")!;
    await handler(null, settings);
    expect(mockStore.saveSettings).toHaveBeenCalledWith(settings);
  });
});
