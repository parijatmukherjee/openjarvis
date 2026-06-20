import { describe, it, expect } from "vitest";

describe("preload smoke", () => {
  it("preload script exists and is valid JavaScript", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const preloadPath = path.resolve(import.meta.dirname, "../dist/preload.js");
    const content = fs.readFileSync(preloadPath, "utf-8");
    expect(content).toContain("contextBridge");
    expect(content).toContain("exposeInMainWorld");
    expect(content).toContain("electronAPI");
  });

  it("preload script uses require for electron", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const preloadPath = path.resolve(import.meta.dirname, "../dist/preload.js");
    const content = fs.readFileSync(preloadPath, "utf-8");
    expect(content).toContain('require("electron")');
  });

  it("preload script exposes all IPC methods", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const preloadPath = path.resolve(import.meta.dirname, "../dist/preload.js");
    const content = fs.readFileSync(preloadPath, "utf-8");
    const methods = [
      "locale:getSystemLocale",
      "settings:load",
      "settings:save",
      "settings:reset",
      "profile:load",
      "profile:save",
      "nexus:getTasks",
      "nexus:getAgents",
      "nexus:getMessages",
      "nexus:clearMessages",
      "nexus:executeIntent",
      "nexus:chatStream",
      "nexus:cancelChatStream",
      "model:list",
      "env:getApiKeys",
      "window:minimize",
      "window:maximize",
      "window:close",
    ];
    for (const method of methods) {
      expect(content).toContain(method);
    }
  });
});
