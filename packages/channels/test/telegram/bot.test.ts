import { describe, it, expect, vi, afterEach } from "vitest";
import { TelegramBot } from "../../src/telegram/bot.js";

describe("TelegramBot", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("sendMessage", () => {
    it("calls correct API endpoint and returns messageId", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      });

      const bot = new TelegramBot({ token: "test-token" });
      const result = await bot.sendMessage(12345, "hello world");
      expect(result).toEqual({ messageId: 42 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/bottest-token/sendMessage",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
      const callArgs = globalThis.fetch as ReturnType<typeof vi.fn>;
      const body = JSON.parse((callArgs.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ chat_id: 12345, text: "hello world" });
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      const bot = new TelegramBot({ token: "test-token" });
      await expect(bot.sendMessage(12345, "hello")).rejects.toThrow(
        "Telegram API sendMessage failed: 403 Forbidden",
      );
    });

    it("throws on API error response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: false, description: "Bad Request: chat not found" }),
      });

      const bot = new TelegramBot({ token: "test-token" });
      await expect(bot.sendMessage(99999, "hello")).rejects.toThrow(
        "Telegram API sendMessage error: Bad Request: chat not found",
      );
    });
  });

  describe("getChat", () => {
    it("returns chat info", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            result: {
              id: -1001234,
              type: "supergroup",
              title: "Test Group",
              username: "testgroup",
            },
          }),
      });

      const bot = new TelegramBot({ token: "test-token" });
      const result = await bot.getChat(-1001234);
      expect(result).toEqual({
        id: -1001234,
        type: "supergroup",
        title: "Test Group",
        username: "testgroup",
      });
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      });

      const bot = new TelegramBot({ token: "test-token" });
      await expect(bot.getChat(12345)).rejects.toThrow(
        "Telegram API getChat failed: 404 Not Found",
      );
    });
  });

  describe("onMessage", () => {
    it("returns unsubscribe function", () => {
      const fetchFn = vi.fn();
      const bot = new TelegramBot(
        { token: "test-token" },
        fetchFn as unknown as typeof globalThis.fetch,
      );
      const handler = vi.fn();
      const unsub = bot.onMessage(handler);
      expect(typeof unsub).toBe("function");
    });

    it("unsubscribes handler", () => {
      const fetchFn = vi.fn();
      const bot = new TelegramBot(
        { token: "test-token" },
        fetchFn as unknown as typeof globalThis.fetch,
      );
      const handler = vi.fn();
      const unsub = bot.onMessage(handler);
      unsub();
    });
  });

  describe("start/stop", () => {
    it("starts polling via getUpdates and stops", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount > 2) {
          await new Promise(() => {});
        }
        return {
          ok: true,
          json: () => Promise.resolve({ ok: true, result: [] }),
        };
      });

      const bot = new TelegramBot(
        { token: "test-token" },
        fetchFn as unknown as typeof globalThis.fetch,
      );

      bot.start();
      await new Promise((r) => setTimeout(r, 150));
      await bot.stop();

      expect(fetchFn).toHaveBeenCalled();
      expect((fetchFn.mock.calls as unknown as string[][])[0]?.[0]).toContain(
        "api.telegram.org/bottest-token/getUpdates",
      );
    });
  });
});
