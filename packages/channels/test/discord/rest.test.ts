import { describe, it, expect, vi } from "vitest";
import { DiscordRest } from "../../src/discord/rest.js";
import type { FetchImpl } from "../../src/discord/rest.js";

function createMockFetch(responses: Array<{ ok: boolean; status: number; json?: unknown; headers?: Record<string, string>; text?: string }>): FetchImpl {
  let callIndex = 0;
  const mock = vi.fn(async () => {
    const r = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: r.ok,
      status: r.status,
      headers: new Headers(r.headers ?? {}),
      json: () => Promise.resolve(r.json ?? {}),
      text: () => Promise.resolve(r.text ?? ""),
    } as Response;
  });
  return mock as unknown as FetchImpl;
}

describe("DiscordRest", () => {
  let rest: DiscordRest;

  describe("constructor", () => {
    it("uses globalThis.fetch when no fetchImpl provided", () => {
      rest = new DiscordRest("token");
      expect(rest).toBeDefined();
    });

    it("accepts custom fetchImpl", () => {
      const customFetch = vi.fn() as unknown as FetchImpl;
      rest = new DiscordRest("token", customFetch);
      expect(rest).toBeDefined();
    });
  });

  describe("sendMessage", () => {
    it("sends a message and returns messageId", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "msg123" } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.sendMessage("chan1", "hello");
      expect(result).toEqual({ messageId: "msg123" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.com/api/v10/channels/chan1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bot test-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("includes content in request body", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "msg456" } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await rest.sendMessage("chan2", "world");
      const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(call[1].body as string)).toEqual({ content: "world" });
    });

    it("throws on non-ok response", async () => {
      const mockFetch = createMockFetch([
        { ok: false, status: 403, text: "Forbidden" },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await expect(rest.sendMessage("chan1", "hello")).rejects.toThrow();
    });
  });

  describe("getChannel", () => {
    it("returns text channel info for type 0", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "c1", name: "general", guild_id: "g1", type: 0 } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.getChannel("c1");
      expect(result).toEqual({ id: "c1", name: "general", guildId: "g1", type: "text" });
    });

    it("returns dm channel for type 1", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "c2", name: "dm-channel", guild_id: null, type: 1 } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.getChannel("c2");
      expect(result).toEqual({ id: "c2", name: "dm-channel", guildId: null, type: "dm" });
    });

    it("returns thread channel for type 11", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "c3", name: "thread", guild_id: "g1", type: 11 } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.getChannel("c3");
      expect(result).toEqual({ id: "c3", name: "thread", guildId: "g1", type: "thread" });
    });

    it("throws on non-ok response", async () => {
      const mockFetch = createMockFetch([
        { ok: false, status: 404, text: "Not Found" },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await expect(rest.getChannel("c1")).rejects.toThrow();
    });
  });

  describe("searchMessages", () => {
    it("searches messages with query and returns mapped results", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: {
            messages: [[{
              id: "m1",
              channel_id: "c1",
              guild_id: "g1",
              author: { id: "u1", username: "alice" },
              content: "hello world",
              timestamp: "2024-01-01T00:00:00.000Z",
              edited_timestamp: null,
              attachments: [],
            }]],
          },
        },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.searchMessages("c1", "hello");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("m1");
      expect(result[0].channelId).toBe("c1");
      expect(result[0].authorId).toBe("u1");
    });

    it("searches messages with limit parameter", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { messages: [] } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await rest.searchMessages("c1", "hello", 5);
      const url = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("limit=5");
    });

    it("returns empty array when messages is missing", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: {} },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.searchMessages("c1", "hello");
      expect(result).toEqual([]);
    });
  });

  describe("registerCommands", () => {
    it("registers commands and returns ids", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: [{ id: "cmd1" }, { id: "cmd2" }],
        },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const result = await rest.registerCommands("app123", "guild1", [
        { name: "ping", description: "Ping!" },
        { name: "hello", description: "Say hello" },
      ]);
      expect(result).toEqual([{ id: "cmd1" }, { id: "cmd2" }]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.com/api/v10/applications/app123/guilds/guild1/commands",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  describe("rate limiting", () => {
    it("handles 429 with Retry-After header and retries", async () => {
      vi.useFakeTimers();
      const mockFetch = createMockFetch([
        { ok: false, status: 429, headers: { "Retry-After": "0.1" } },
        { ok: true, status: 200, json: { id: "msg1" } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const promise = rest.sendMessage("c1", "retry test");
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;
      expect(result).toEqual({ messageId: "msg1" });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("handles 429 without Retry-After using default 1s", async () => {
      vi.useFakeTimers();
      const mockFetch = createMockFetch([
        { ok: false, status: 429, headers: {} },
        { ok: true, status: 200, json: { id: "msg2" } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const promise = rest.sendMessage("c1", "retry test");
      await vi.advanceTimersByTimeAsync(1500);
      const result = await promise;
      expect(result).toEqual({ messageId: "msg2" });

      vi.useRealTimers();
    });

    it("tracks X-RateLimit-Bucket headers", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: { id: "msg1" },
          headers: { "X-RateLimit-Bucket": "bucket1", "X-RateLimit-Remaining": "4", "X-RateLimit-Reset": "1700000000" },
        },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await rest.sendMessage("c1", "hello");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("5xx retry", () => {
    it("retries on 500 with exponential backoff", async () => {
      vi.useFakeTimers();
      const mockFetch = createMockFetch([
        { ok: false, status: 500, text: "Internal Server Error" },
        { ok: true, status: 200, json: { id: "msg1" } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      const promise = rest.sendMessage("c1", "retry");
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;
      expect(result).toEqual({ messageId: "msg1" });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("gives up after max 3 retries on 5xx", async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const responses = [
        { ok: false, status: 500, text: "Internal Server Error" },
        { ok: false, status: 502, text: "Bad Gateway" },
        { ok: false, status: 503, text: "Service Unavailable" },
        { ok: false, status: 500, text: "Internal Server Error" },
      ];
      const mockFetch = vi.fn(async () => {
        const r = responses[callCount++];
        return {
          ok: r.ok,
          status: r.status,
          headers: new Headers(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(r.text ?? ""),
        } as Response;
      });
      rest = new DiscordRest("test-token", mockFetch as unknown as FetchImpl);

      let error: Error | undefined;
      rest.sendMessage("c1", "fail").catch((e) => { error = e; });
      await vi.advanceTimersByTimeAsync(30000);
      await vi.runAllTimersAsync();
      expect(error).toBeInstanceOf(Error);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });
  });

  describe("GET requests", () => {
    it("does not include Content-Type header for GET requests", async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, json: { id: "c1", name: "general", guild_id: "g1", type: 0 } },
      ]);
      rest = new DiscordRest("test-token", mockFetch);

      await rest.getChannel("c1");
      const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = call[1].headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });
});