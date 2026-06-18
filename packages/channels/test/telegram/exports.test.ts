import { describe, it, expect } from "vitest";

describe("@openjarvis/channels telegram exports", () => {
  it("exports telegram tools", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createTelegramSendTool).toBeTypeOf("function");
    expect(mod.createTelegramReadTool).toBeTypeOf("function");
    expect(mod.registerTelegramTools).toBeTypeOf("function");
  });

  it("exports TelegramBot", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.TelegramBot).toBeTypeOf("function");
  });

  it("exports TelegramSessionMapper", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.TelegramSessionMapper).toBeTypeOf("function");
  });

  it("exports telegram types", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createTelegramSendTool).toBeTypeOf("function");
  });
});
