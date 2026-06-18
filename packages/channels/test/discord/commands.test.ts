import { describe, it, expect, vi } from "vitest";
import { DiscordCommandRegistrar } from "../../src/discord/commands.js";
import type { SlashCommand } from "../../src/discord/commands.js";
import { DiscordRest } from "../../src/discord/rest.js";

function createMockRest(): {
  rest: DiscordRest;
  registerCommandsMock: ReturnType<typeof vi.fn>;
} {
  const registerCommandsMock = vi.fn().mockResolvedValue([{ id: "cmd1" }]);
  const rest = new DiscordRest("test-token", vi.fn() as unknown as typeof globalThis.fetch);
  rest.registerCommands = registerCommandsMock;
  return { rest, registerCommandsMock };
}

describe("DiscordCommandRegistrar", () => {
  it("registers commands via REST client", async () => {
    const { rest, registerCommandsMock } = createMockRest();
    const registrar = new DiscordCommandRegistrar(rest, "app123");

    const commands: SlashCommand[] = [
      { name: "ping", description: "Ping!" },
      { name: "hello", description: "Say hello" },
    ];

    const result = await registrar.registerCommands("guild1", commands);
    expect(registerCommandsMock).toHaveBeenCalledWith("app123", "guild1", commands);
    expect(result).toEqual([{ id: "cmd1" }]);
  });

  it("passes applicationId from constructor", async () => {
    const { rest, registerCommandsMock } = createMockRest();
    const registrar = new DiscordCommandRegistrar(rest, "my-app-id");

    await registrar.registerCommands("guild1", []);
    expect(registerCommandsMock).toHaveBeenCalledWith("my-app-id", "guild1", []);
  });

  it("forwards slash commands with options", async () => {
    const { rest, registerCommandsMock } = createMockRest();
    const registrar = new DiscordCommandRegistrar(rest, "app456");

    const commands: SlashCommand[] = [
      {
        name: "search",
        description: "Search messages",
        options: [{ type: 3, name: "query", description: "Search query", required: true }],
      },
    ];

    await registrar.registerCommands("guild2", commands);
    expect(registerCommandsMock).toHaveBeenCalledWith("app456", "guild2", commands);
  });
});
