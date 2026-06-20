import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerIpcHandlers } from "../src/main/ipc.js";
import { NexusEngine } from "@openjarvis/jarvis/nexus";

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

  it("nexus:chatStream returns a sessionId and persists the user message synchronously", async () => {
    mockStore.appendMessage.mockResolvedValue(undefined);
    const handler = handlers.get("nexus:chatStream")!;
    const result = (await handler(null, "hello world")) as { sessionId: string };
    expect(typeof result.sessionId).toBe("string");
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(mockStore.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user", text: "hello world" }),
    );
  });

  it("nexus:cancelChatStream aborts an active stream registered by nexus:chatStream", async () => {
    mockStore.appendMessage.mockResolvedValue(undefined);
    let capturedSignal: AbortSignal | undefined;
    let releaseSpy: (() => void) | undefined;
    const releasePromise = new Promise<void>((resolve) => {
      releaseSpy = resolve;
    });
    const spy = vi
      .spyOn(NexusEngine.prototype, "executeChatStream")
      .mockImplementation(async (_text, _onChunk, signal) => {
        capturedSignal = signal;
        await releasePromise;
      });
    try {
      const streamHandler = handlers.get("nexus:chatStream")!;
      const cancelHandler = handlers.get("nexus:cancelChatStream")!;
      const { sessionId } = (await streamHandler(null, "hi")) as { sessionId: string };
      for (let i = 0; i < 50 && !capturedSignal; i++) {
        await new Promise((r) => setImmediate(r));
      }
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(false);
      cancelHandler(null, sessionId);
      expect(capturedSignal!.aborted).toBe(true);
    } finally {
      releaseSpy?.();
      spy.mockRestore();
    }
  });
});
