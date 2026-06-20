import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopStore } from "../src/main/store.js";

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), "oj-desktop-"));
}

describe("DesktopStore", () => {
  let dir: string;
  let store: DesktopStore;

  beforeEach(async () => {
    dir = await makeTempDir();
    store = new DesktopStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns default settings when file is missing", async () => {
    const settings = await store.loadSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.shortcut).toBe("CommandOrControl+Shift+J");
  });

  it("round-trips custom settings", async () => {
    const settings = {
      version: 1 as const,
      theme: "light" as const,
      reducedMotion: true,
      shortcut: "Alt+J",
      autoStart: false,
      locale: "fr-FR",
      model: { provider: "ollama" as const, model: "llama3", baseUrl: "http://127.0.0.1:11434" },
    };
    await store.saveSettings(settings);
    const loaded = await store.loadSettings();
    expect(loaded).toEqual(settings);
  });

  it("round-trips profile with userName", async () => {
    const profile = { version: 1 as const, userName: "Ada" };
    await store.saveProfile(profile);
    const loaded = await store.loadProfile();
    expect(loaded.userName).toBe("Ada");
  });

  it("merges partial legacy settings", async () => {
    await store.saveSettings({
      version: 1 as const,
      theme: "light" as const,
      reducedMotion: false,
      shortcut: "Alt+J",
      autoStart: true,
      locale: "en-US",
      model: { provider: "ollama" as const, model: "llama3", baseUrl: "http://127.0.0.1:11434" },
    });
    const fresh = new DesktopStore(dir);
    const loaded = await fresh.loadSettings();
    expect(loaded.shortcut).toBe("Alt+J");
    expect(loaded.version).toBe(1);
  });

  it("recovers from corrupt JSON", async () => {
    const corruptPath = join(dir, "settings.json");
    await writeFile(corruptPath, "{ not json", "utf-8");
    const loaded = await store.loadSettings();
    expect(loaded.theme).toBe("dark");
  });

  it("trims empty userName back to default", async () => {
    const profile = { version: 1 as const, userName: "   " };
    await store.saveProfile(profile);
    const loaded = await store.loadProfile();
    expect(loaded.userName).toBe("User");
  });

  describe("chat history", () => {
    const userMsg = {
      id: "m-1",
      type: "user" as const,
      text: "hi",
      timestamp: "12:00",
    };
    const jarvisMsg = {
      id: "m-2",
      type: "jarvis" as const,
      text: "hello!",
      timestamp: "12:00",
    };
    const systemMsg = {
      id: "m-3",
      type: "system" as const,
      text: "boot",
      timestamp: "12:00",
    };

    it("returns empty list when no file is present", async () => {
      const loaded = await store.loadMessages();
      expect(loaded).toEqual([]);
    });

    it("round-trips appendMessage across store instances", async () => {
      await store.appendMessage(userMsg);
      await store.appendMessage(jarvisMsg);
      const fresh = new DesktopStore(dir);
      const loaded = await fresh.loadMessages();
      expect(loaded).toEqual([userMsg, jarvisMsg]);
    });

    it("preserves message types (user/jarvis/system)", async () => {
      await store.appendMessage(userMsg);
      await store.appendMessage(jarvisMsg);
      await store.appendMessage(systemMsg);
      const loaded = await store.loadMessages();
      expect(loaded).toEqual([userMsg, jarvisMsg, systemMsg]);
    });

    it("clearMessages empties the history", async () => {
      await store.appendMessage(userMsg);
      await store.appendMessage(jarvisMsg);
      await store.clearMessages();
      const loaded = await store.loadMessages();
      expect(loaded).toEqual([]);
    });

    it("recovers from corrupt messages.json (returns empty)", async () => {
      await writeFile(join(dir, "messages.json"), "{ not json", "utf-8");
      const loaded = await store.loadMessages();
      expect(loaded).toEqual([]);
    });

    it("drops messages past the 500-item cap (FIFO)", async () => {
      for (let i = 0; i < 510; i += 1) {
        await store.appendMessage({
          id: `m-${i}`,
          type: "user",
          text: String(i),
          timestamp: "12:00",
        });
      }
      const loaded = await store.loadMessages();
      expect(loaded.length).toBe(500);
      expect(loaded[0]?.id).toBe("m-10");
      expect(loaded[loaded.length - 1]?.id).toBe("m-509");
    }, 30_000);

    it("rejects messages that do not match the schema (does not write)", async () => {
      await expect(
        store.appendMessage({ id: "x", text: "hi", timestamp: "12:00" } as never),
      ).rejects.toThrow();
      const loaded = await store.loadMessages();
      expect(loaded).toEqual([]);
    });
  });
});
