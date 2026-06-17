import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscordMessage } from "../../src/discord/types.js";

const mockLogin = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock("discord.js", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      login: mockLogin,
      destroy: mockDestroy,
      on: mockOn,
      off: mockOff,
    })),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      DirectMessages: 8,
    },
  };
});

describe("DiscordGateway", () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockDestroy.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
  });

  it("creates gateway with config", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    expect(gw).toBeDefined();
  });

  it("start() calls client.login", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    await gw.start();
    expect(mockLogin).toHaveBeenCalledWith("tok");
  });

  it("stop() calls client.destroy", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    await gw.start();
    gw.stop();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("onMessage registers handler and returns unsubscribe", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    const handler = vi.fn();
    const unsub = gw.onMessage(handler);
    expect(mockOn).toHaveBeenCalledWith("messageCreate", expect.any(Function));
    expect(typeof unsub).toBe("function");
  });

  it("bot messages are ignored", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    const handler = vi.fn();
    gw.onMessage(handler);

    const botMsg = {
      id: "1",
      channelId: "c1",
      guildId: "g1",
      author: { id: "bot1", username: "bot", bot: true },
      content: "beep",
      createdTimestamp: Date.now(),
      editedTimestamp: null,
      attachments: { map: (fn: (a: unknown) => unknown) => [] },
    };
    expect(capturedListener).toBeDefined();
    capturedListener!(botMsg);
    expect(handler).not.toHaveBeenCalled();
  });

  it("non-bot messages are forwarded", async () => {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = new DiscordGateway({ token: "tok", guilds: ["g1"] });
    const handler = vi.fn();
    gw.onMessage(handler);

    const userMsg = {
      id: "2",
      channelId: "c1",
      guildId: "g1",
      author: { id: "user1", username: "alice", bot: false },
      content: "hello",
      createdTimestamp: Date.now(),
      editedTimestamp: null,
      attachments: {
        map: (fn: (a: unknown) => unknown) => [] as unknown[],
      },
    };
    expect(capturedListener).toBeDefined();
    capturedListener!(userMsg);
    expect(handler).toHaveBeenCalled();
  });
});