import { describe, it, expect } from "vitest";

describe("@openjarvis/channels exports", () => {
  it("exports tools members", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createDiscordSendTool).toBeTypeOf("function");
    expect(mod.createDiscordReadTool).toBeTypeOf("function");
    expect(mod.createDiscordSearchTool).toBeTypeOf("function");
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

  it("exports rest", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.DiscordRest).toBeTypeOf("function");
  });

  it("exports command registrar", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.DiscordCommandRegistrar).toBeTypeOf("function");
  });

  it("exports event handlers", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.mapMessageCreate).toBeTypeOf("function");
    expect(mod.mapMessageUpdate).toBeTypeOf("function");
    expect(mod.mapMessageDelete).toBeTypeOf("function");
    expect(mod.mapReactionAdd).toBeTypeOf("function");
    expect(mod.mapInteractionCreate).toBeTypeOf("function");
  });
});
