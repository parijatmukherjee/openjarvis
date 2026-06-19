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
  loadMessages: vi.fn(),
  appendMessage: vi.fn(),
  clearMessages: vi.fn(),
};

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerIpcHandlers(
      mockStore as unknown as Parameters<typeof registerIpcHandlers>[0],
      ipcMain,
      () => null,
    );
  });

  it("registers settings and profile handlers", () => {
    expect(ipcMain.handle).toHaveBeenCalledWith("settings:load", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("settings:save", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("profile:load", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("profile:save", expect.any(Function));
  });

  it("delegates settings:load to the store", async () => {
    const settings = {
      version: 1,
      theme: "dark" as const,
      reducedMotion: false,
      shortcut: "Cmd+J",
      autoStart: true,
      locale: "en-US",
      model: { provider: "ollama" as const, model: "llama3", baseUrl: "http://127.0.0.1:11434" },
    };
    mockStore.loadSettings.mockResolvedValue(settings);
    const handler = handlers.get("settings:load")!;
    const result = await handler();
    expect(result).toMatchObject(settings);
  });

  it("delegates settings:save to the store", async () => {
    const settings = {
      version: 1,
      theme: "light" as const,
      reducedMotion: true,
      shortcut: "Alt+J",
      autoStart: false,
      locale: "fr-FR",
    };
    const handler = handlers.get("settings:save")!;
    await handler(null, settings);
    expect(mockStore.saveSettings).toHaveBeenCalledWith(settings);
  });

  it("registers nexus:clearMessages handler", () => {
    expect(ipcMain.handle).toHaveBeenCalledWith("nexus:clearMessages", expect.any(Function));
  });

  it("nexus:getMessages delegates to store.loadMessages", async () => {
    const messages = [
      { id: "m-1", type: "user", text: "hi", timestamp: "12:00" },
      { id: "m-2", type: "jarvis", text: "hello", timestamp: "12:00" },
    ];
    mockStore.loadMessages.mockResolvedValue(messages);
    const handler = handlers.get("nexus:getMessages")!;
    const result = await handler();
    expect(mockStore.loadMessages).toHaveBeenCalledOnce();
    expect(result).toBe(messages);
  });

  it("nexus:clearMessages delegates to store.clearMessages", async () => {
    mockStore.clearMessages.mockResolvedValue(undefined);
    const handler = handlers.get("nexus:clearMessages")!;
    await handler();
    expect(mockStore.clearMessages).toHaveBeenCalledOnce();
  });
});
