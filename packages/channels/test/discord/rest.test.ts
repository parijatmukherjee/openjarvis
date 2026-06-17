import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiscordRest } from "../../src/discord/rest.js";

describe("DiscordRest", () => {
  const originalFetch = globalThis.fetch;
  let rest: DiscordRest;

  beforeEach(() => {
    rest = new DiscordRest("test-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("sendMessage", () => {
    it("sends a message and returns messageId", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "msg123" }),
      });

      const result = await rest.sendMessage("chan1", "hello");
      expect(result).toEqual({ messageId: "msg123" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
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
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "msg456" }),
      });

      await rest.sendMessage("chan2", "world");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(call[1].body)).toEqual({ content: "world" });
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(rest.sendMessage("chan1", "hello")).rejects.toThrow(
        "Discord REST sendMessage failed: 403 Forbidden",
      );
    });
  });

  describe("getChannel", () => {
    it("returns text channel info for type 0", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "c1", name: "general", guild_id: "g1", type: 0 }),
      });

      const result = await rest.getChannel("c1");
      expect(result).toEqual({ id: "c1", name: "general", guildId: "g1", type: "text" });
    });

    it("returns dm channel for type 1", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "c2", name: "dm-channel", guild_id: null, type: 1 }),
      });

      const result = await rest.getChannel("c2");
      expect(result).toEqual({ id: "c2", name: "dm-channel", guildId: null, type: "dm" });
    });

    it("returns thread channel for type 11", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "c3", name: "thread", guild_id: "g1", type: 11 }),
      });

      const result = await rest.getChannel("c3");
      expect(result).toEqual({ id: "c3", name: "thread", guildId: "g1", type: "thread" });
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      });

      await expect(rest.getChannel("c1")).rejects.toThrow(
        "Discord REST getChannel failed: 404 Not Found",
      );
    });

    it("sends authorization header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "c1", name: "general", guild_id: "g1", type: 0 }),
      });

      await rest.getChannel("c1");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://discord.com/api/v10/channels/c1",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bot test-token",
          }),
        }),
      );
    });
  });
});