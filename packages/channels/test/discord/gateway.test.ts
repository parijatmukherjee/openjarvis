import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayOP } from "../../src/discord/types.js";
import type { WSLike } from "../../src/discord/gateway.js";

const DEFAULT_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

function createFakeWs(): { ws: WSLike; trigger: (event: string, ...args: unknown[]) => void } {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const on = (_event: string, _listener: (...args: unknown[]) => void): void => {
    if (!_event) return;
    if (!listeners[_event]) listeners[_event] = [];
    listeners[_event].push(_listener);
  };
  const ws: WSLike = {
    on: on as WSLike["on"],
    close(_code?: number, _data?: string): void {
      const cbs = listeners["close"] ?? [];
      for (const cb of cbs) cb(1000, Buffer.from(""));
    },
    send(_data: string): void {},
    readyState: 1,
  };
  const trigger = (event: string, ...args: unknown[]) => {
    const cbs = listeners[event] ?? [];
    for (const cb of cbs) cb(...args);
  };
  return { ws, trigger };
}

function payload(op: GatewayOP, d?: unknown, t?: string, s?: number): Buffer {
  return Buffer.from(JSON.stringify({ op, d, t, s }));
}

describe("DiscordGateway", () => {
  let fakeWs: { ws: WSLike; trigger: (event: string, ...args: unknown[]) => void };
  let sent: string[];
  let closed: boolean;

  beforeEach(() => {
    fakeWs = createFakeWs();
    sent = [];
    closed = false;
    fakeWs.ws.send = (data: string) => {
      sent.push(data);
    };
    const originalClose = fakeWs.ws.close.bind(fakeWs.ws);
    fakeWs.ws.close = (code?: number, data?: string) => {
      closed = true;
      originalClose(code, data);
    };
  });

  async function createGateway(opts?: { sessionId?: string; seq?: number }) {
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway(
      { token: "test-token", guilds: ["g1"] },
      (_url: string) => fakeWs.ws,
      () => Promise.resolve(DEFAULT_URL),
    );
    if (opts?.sessionId) {
      (gw as unknown as Record<string, unknown>).sessionId = opts.sessionId;
    }
    if (opts?.seq !== undefined) {
      (gw as unknown as Record<string, unknown>).sequence = opts.seq;
    }
    return gw;
  }

  it("connects and sends IDENTIFY after HELLO", async () => {
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 41250 }));

    const identifyMsg = sent.find((s) => {
      const p = JSON.parse(s);
      return p.op === GatewayOP.IDENTIFY;
    });
    expect(identifyMsg).toBeDefined();
    const parsed = JSON.parse(identifyMsg!);
    expect(parsed.d.token).toBe("test-token");
    expect(parsed.d.intents).toBe(32767);
  });

  it("sends HEARTBEAT after HELLO", async () => {
    vi.useFakeTimers();
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 1000 }));

    sent.length = 0;
    vi.advanceTimersByTime(1000);
    const heartbeatMsg = sent.find((s) => {
      const p = JSON.parse(s);
      return p.op === GatewayOP.HEARTBEAT;
    });
    expect(heartbeatMsg).toBeDefined();

    vi.useRealTimers();
  });

  it("sends HEARTBEAT with last sequence number", async () => {
    vi.useFakeTimers();
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 1000 }));

    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, {}, "TYPING_START", 42));

    sent.length = 0;
    vi.advanceTimersByTime(1000);

    const hb = JSON.parse(sent.find((s) => JSON.parse(s).op === GatewayOP.HEARTBEAT)!);
    expect(hb.d).toBe(42);

    vi.useRealTimers();
  });

  it("sends RESUME when session exists", async () => {
    const gw = await createGateway({ sessionId: "sess123", seq: 5 });
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const resumeMsg = sent.find((s) => {
      const p = JSON.parse(s);
      return p.op === GatewayOP.RESUME;
    });
    expect(resumeMsg).toBeDefined();
    const parsed = JSON.parse(resumeMsg!);
    expect(parsed.d.token).toBe("test-token");
    expect(parsed.d.session_id).toBe("sess123");
    expect(parsed.d.seq).toBe(5);
  });

  it("reconnects with exponential backoff on close", async () => {
    vi.useFakeTimers();
    const fakeWses: { ws: WSLike; trigger: (event: string, ...args: unknown[]) => void }[] = [];
    const connectFn = vi.fn((_url: string) => {
      const fws = createFakeWs();
      fws.ws.send = () => {};
      fakeWses.push(fws);
      return fws.ws;
    });
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "test-token", guilds: ["g1"] }, connectFn, () =>
      Promise.resolve(DEFAULT_URL),
    );

    await gw.start();
    expect(connectFn).toHaveBeenCalledTimes(1);

    fakeWses[0].trigger("close", 1000, Buffer.from(""));

    vi.advanceTimersByTime(3000);
    expect(connectFn.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });

  it("schedules reconnect on op 7 RECONNECT", async () => {
    vi.useFakeTimers();
    const fakeWses: { ws: WSLike; trigger: (event: string, ...args: unknown[]) => void }[] = [];
    const connectFn = vi.fn((_url: string) => {
      const fws = createFakeWs();
      fws.ws.send = () => {};
      fakeWses.push(fws);
      return fws.ws;
    });
    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "test-token", guilds: ["g1"] }, connectFn, () =>
      Promise.resolve(DEFAULT_URL),
    );

    await gw.start();
    fakeWses[0].trigger("open");
    fakeWses[0].trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const initialCalls = connectFn.mock.calls.length;
    fakeWses[0].trigger("message", payload(GatewayOP.RECONNECT));

    vi.advanceTimersByTime(5000);
    expect(connectFn.mock.calls.length).toBeGreaterThan(initialCalls);

    vi.useRealTimers();
  });

  it("maps raw DISPATCH MESSAGE_CREATE to DiscordMessage", async () => {
    const gw = await createGateway();
    const handler = vi.fn();
    gw.onMessage(handler);

    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const rawMsg = {
      id: "msg1",
      channel_id: "chan1",
      guild_id: "guild1",
      author: { id: "uid1", username: "bob", bot: false },
      content: "hi there",
      timestamp: "2024-01-01T00:00:00.000Z",
      edited_timestamp: null,
      attachments: [
        {
          id: "att1",
          url: "https://example.com/file.png",
          filename: "file.png",
          content_type: "image/png",
          size: 1234,
        },
      ],
    };

    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, rawMsg, "MESSAGE_CREATE", 1));

    expect(handler).toHaveBeenCalledTimes(1);
    const mapped = handler.mock.calls[0][0];
    expect(mapped.id).toBe("msg1");
    expect(mapped.channelId).toBe("chan1");
    expect(mapped.guildId).toBe("guild1");
    expect(mapped.authorId).toBe("uid1");
    expect(mapped.authorUsername).toBe("bob");
    expect(mapped.content).toBe("hi there");
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

  it("ignores bot messages", async () => {
    const gw = await createGateway();
    const handler = vi.fn();
    gw.onMessage(handler);

    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const botMsg = {
      id: "b1",
      channel_id: "c1",
      guild_id: "g1",
      author: { id: "bot1", username: "botuser", bot: true },
      content: "beep",
      timestamp: "2024-01-01T00:00:00.000Z",
      edited_timestamp: null,
      attachments: [],
    };

    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, botMsg, "MESSAGE_CREATE", 1));
    expect(handler).not.toHaveBeenCalled();
  });

  it("stores session_id and resume_gateway_url from READY", async () => {
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const readyData = { session_id: "abc123", resume_gateway_url: "wss://resume.gg" };
    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, readyData, "READY", 5));

    const internal = gw as unknown as Record<string, unknown>;
    expect(internal.sessionId).toBe("abc123");
    expect(internal.resumeUrl).toBe("wss://resume.gg?v=10&encoding=json");
  });

  it("stop() closes WebSocket and clears heartbeat", async () => {
    vi.useFakeTimers();
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 1000 }));

    gw.stop();
    expect(closed).toBe(true);

    vi.useRealTimers();
  });

  it("onMessage unsubscribe works", async () => {
    const gw = await createGateway();
    const handler = vi.fn();
    const unsub = gw.onMessage(handler);
    unsub();

    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const rawMsg = {
      id: "m1",
      channel_id: "c1",
      guild_id: "g1",
      author: { id: "u1", username: "alice", bot: false },
      content: "hello",
      timestamp: "2024-01-01T00:00:00.000Z",
      edited_timestamp: null,
      attachments: [],
    };
    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, rawMsg, "MESSAGE_CREATE", 1));
    expect(handler).not.toHaveBeenCalled();
  });

  it("onDispatch receives all dispatch events", async () => {
    const gw = await createGateway();
    const dispatchHandler = vi.fn();
    gw.onDispatch(dispatchHandler);

    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    const readyData = { session_id: "s1" };
    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, readyData, "READY", 3));

    expect(dispatchHandler).toHaveBeenCalledTimes(1);
    expect(dispatchHandler.mock.calls[0][0].type).toBe("READY");
    expect(dispatchHandler.mock.calls[0][0].data).toEqual(readyData);
  });

  it("updates sequence number from DISPATCH payloads", async () => {
    const gw = await createGateway();
    await gw.start();
    fakeWs.trigger("open");
    fakeWs.trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));

    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, {}, "TYPING_START", 7));
    fakeWs.trigger("message", payload(GatewayOP.DISPATCH, {}, "TYPING_START", 8));

    const internal = gw as unknown as Record<string, unknown>;
    expect(internal.sequence).toBe(8);
  });

  it("exponential backoff increases delay on successive failures", async () => {
    vi.useFakeTimers();
    const fakeWses: { ws: WSLike; trigger: (event: string, ...args: unknown[]) => void }[] = [];
    const connectFn = vi.fn((_url: string) => {
      const fws = createFakeWs();
      fws.ws.send = () => {};
      fakeWses.push(fws);
      return fws.ws;
    });

    const { DiscordGateway } = await import("../../src/discord/gateway.js");
    const gw = new DiscordGateway({ token: "test-token", guilds: ["g1"] }, connectFn, () =>
      Promise.resolve(DEFAULT_URL),
    );

    await gw.start();
    expect(connectFn).toHaveBeenCalledTimes(1);

    fakeWses[0].trigger("open");
    fakeWses[0].trigger("message", payload(GatewayOP.HELLO, { heartbeat_interval: 45000 }));
    fakeWses[0].trigger("close", 1006, Buffer.from(""));

    vi.advanceTimersByTime(3000);
    expect(connectFn.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });
});
