import { describe, it, expect } from "vitest";

describe("@openjarvis/channels exports", () => {
  it("exports tools members", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createDiscordSendTool).toBeTypeOf("function");
    expect(mod.createDiscordReadTool).toBeTypeOf("function");
    expect(mod.registerDiscordTools).toBeTypeOf("function");
  });

  it("exports types", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.DiscordSessionMapper).toBeTypeOf("function");
  });

  it("exports gateway", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.DiscordGateway).toBeTypeOf("function");
  });
});