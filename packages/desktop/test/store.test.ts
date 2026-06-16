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
    const settings = { version: 1 as const, theme: "light" as const, reducedMotion: true, shortcut: "Alt+J", autoStart: false, locale: "fr-FR" };
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
    await store.saveSettings({ version: 1 as const, theme: "light" as const, reducedMotion: false, shortcut: "Alt+J", autoStart: true, locale: "en-US" });
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
});
