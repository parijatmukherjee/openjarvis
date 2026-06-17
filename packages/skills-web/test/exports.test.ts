import { describe, it, expect } from "vitest";

describe("@openjarvis/skills-web exports", () => {
  it("exports createWebFetchTool, registerWebFetchTools, WebFetchConfig", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createWebFetchTool).toBeTypeOf("function");
    expect(mod.registerWebFetchTools).toBeTypeOf("function");
    expect(mod.WebFetchConfig).toBeUndefined();
  });
});
