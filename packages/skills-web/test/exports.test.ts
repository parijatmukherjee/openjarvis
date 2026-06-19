import { describe, it, expect } from "vitest";

describe("@openjarvis/skills-web exports", () => {
  it("exports web fetch tools", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createWebFetchTool).toBeTypeOf("function");
    expect(mod.registerWebFetchTools).toBeTypeOf("function");
    expect("WebFetchConfig" in mod).toBe(false);
  });

  it("exports browser automation tools and types", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createBrowserNavigateTool).toBeTypeOf("function");
    expect(mod.createBrowserClickTool).toBeTypeOf("function");
    expect(mod.createBrowserTypeTool).toBeTypeOf("function");
    expect(mod.createBrowserScreenshotTool).toBeTypeOf("function");
    expect(mod.createBrowserAccessibilityTool).toBeTypeOf("function");
    expect(mod.createBrowserListTabsTool).toBeTypeOf("function");
    expect(mod.createBrowserSwitchTabTool).toBeTypeOf("function");
    expect(mod.createBrowserCloseTabTool).toBeTypeOf("function");
    expect(mod.registerBrowserTools).toBeTypeOf("function");
    expect(mod.PlaywrightBrowserAutomation).toBeTypeOf("function");
  });
});
