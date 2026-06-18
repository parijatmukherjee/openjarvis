import { describe, it, expect, vi, beforeEach } from "vitest";
import type {} from "../../src/discord/types.js";

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

  async function createGateway() {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    return new DiscordGateway({ token: "tok", guilds: ["g1"] });
  }

  it("creates gateway with config", async () => {
    const gw = await createGateway();
    expect(gw).toBeDefined();
  });

  it("start() calls client.login", async () => {
    const gw = await createGateway();
    await gw.start();
    expect(mockLogin).toHaveBeenCalledWith("tok");
  });

  it("stop() calls client.destroy", async () => {
    const gw = await createGateway();
    await gw.start();
    gw.stop();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("onMessage registers handler and returns unsubscribe", async () => {
    const gw = await createGateway();
    const handler = vi.fn();
    const unsub = gw.onMessage(handler);
    expect(mockOn).toHaveBeenCalledWith("messageCreate", expect.any(Function));
    expect(typeof unsub).toBe("function");
  });

  it("unsubscribe calls client.off", async () => {
    const gw = await createGateway();
    const handler = vi.fn();
    const unsub = gw.onMessage(handler);
    unsub();
    expect(mockOff).toHaveBeenCalledWith("messageCreate", expect.any(Function));
  });

  it("bot messages are ignored", async () => {
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = await createGateway();
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
      attachments: { map: (_fn: (a: unknown) => unknown) => [] },
    };
    expect(capturedListener).toBeDefined();
    capturedListener!(botMsg);
    expect(handler).not.toHaveBeenCalled();
  });

  it("non-bot messages are forwarded", async () => {
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = await createGateway();
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
        map: (_fn: (a: unknown) => unknown) => [] as unknown[],
      },
    };
    expect(capturedListener).toBeDefined();
    capturedListener!(userMsg);
    expect(handler).toHaveBeenCalled();
  });

  it("maps message fields correctly", async () => {
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = await createGateway();
    const handler = vi.fn();
    gw.onMessage(handler);

    const userMsg = {
      id: "msg1",
      channelId: "chan1",
      guildId: "guild1",
      author: { id: "uid1", username: "bob", bot: false },
      content: "hi there",
      createdTimestamp: 1700000000000,
      editedTimestamp: 1700000001000,
      attachments: {
        map: (
          cb: (a: {
            id: string;
            url: string;
            name: string;
            contentType: string | null;
            size: number;
          }) => unknown,
        ) =>
          [
            {
              id: "att1",
              url: "https://example.com/file.png",
              name: "file.png",
              contentType: "image/png",
              size: 1234,
            },
          ].map(cb),
      },
    };
    capturedListener!(userMsg);
    const mapped = handler.mock.calls[0][0];
    expect(mapped.id).toBe("msg1");
    expect(mapped.channelId).toBe("chan1");
    expect(mapped.guildId).toBe("guild1");
    expect(mapped.authorId).toBe("uid1");
    expect(mapped.authorUsername).toBe("bob");
    expect(mapped.content).toBe("hi there");
    expect(mapped.timestamp).toBe(1700000000000);
    expect(mapped.editedTimestamp).toBe(1700000001000);
    expect(mapped.attachments).toEqual([
      {
        id: "att1",
        url: "https://example.com/file.png",
        filename: "file.png",
        contentType: "image/png",
        size: 1234,
      },
    ]);
  });

  it("maps null guildId", async () => {
    let capturedListener: ((raw: unknown) => void) | undefined;
    mockOn.mockImplementation((_event: string, listener: (raw: unknown) => void) => {
      capturedListener = listener;
    });
    const gw = await createGateway();
    const handler = vi.fn();
    gw.onMessage(handler);

    const dmMsg = {
      id: "dm1",
      channelId: "dmchan1",
      guildId: null,
      author: { id: "u1", username: "carol", bot: false },
      content: "private msg",
      createdTimestamp: Date.now(),
      editedTimestamp: null,
      attachments: { map: (_fn: (a: unknown) => unknown) => [] },
    };
    capturedListener!(dmMsg);
    expect(handler.mock.calls[0][0].guildId).toBeNull();
  });
});
