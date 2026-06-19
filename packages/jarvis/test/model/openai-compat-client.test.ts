import { describe, it, expect, vi } from "vitest";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";
import { ModelError } from "../../src/model/error.js";
import type { ModelConfig } from "../../src/model/types.js";

function mockFetch(
  fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch {
  const wrapped: typeof globalThis.fetch = async (input, init) => {
    const follow = (init as RequestInit | undefined)?.redirect === "follow";
    let current = await fn(input as string | URL | Request, init);
    let hops = 0;
    while (
      follow &&
      current.status >= 300 &&
      current.status < 400 &&
      current.headers.get("location") &&
      hops < 5
    ) {
      const loc = current.headers.get("location")!;
      current = await fn(loc, init);
      hops += 1;
    }
    return current;
  };
  return wrapped;
}

const defaultConfig: ModelConfig = {
  provider: "openai-compat",
  model: "gpt-4",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key",
};

describe("OpenAICompatClient", () => {
  describe("chat", () => {
    it("sends prompt and returns response", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl-1",
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");

      expect(result).toEqual({ content: "hello", model: "gpt-4", done: true });
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("prepends system message when provided", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.messages).toEqual([
          { role: "system", content: "You are helpful" },
          { role: "user", content: "hi" },
        ]);
        return new Response(
          JSON.stringify({
            id: "chatcmpl-1",
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      await client.chat("hi", "You are helpful");
    });

    it("follows 301 redirects on chat endpoint", async () => {
      const responses: Record<string, () => Response> = {
        "https://api.openai.com/v1/chat/completions": () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://api.openai.com/v1/chat/completions/" },
          }),
        "https://api.openai.com/v1/chat/completions/": () =>
          new Response(
            JSON.stringify({
              id: "chatcmpl-1",
              model: "gpt-4",
              choices: [
                { message: { role: "assistant", content: "hello" }, finish_reason: "stop" },
              ],
            }),
            { status: 200 },
          ),
      };
      const fn = vi.fn(async (url: string | URL | Request) => {
        const key = url.toString();
        const responder = responses[key];
        if (!responder) {
          throw new Error(`unexpected URL: ${key}`);
        }
        return responder();
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.content).toBe("hello");
    });

    it("sends Authorization header when apiKey is provided", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("Bearer test-key");
        expect(headers["Content-Type"]).toBe("application/json");
        return new Response(
          JSON.stringify({
            id: "chatcmpl-1",
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      await client.chat("hi");
    });

    it("does not send Authorization header when apiKey is not set", async () => {
      const config: ModelConfig = {
        provider: "openai-compat",
        model: "gpt-4",
        baseUrl: "https://api.example.com",
      };
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBeUndefined();
        return new Response(
          JSON.stringify({
            id: "chatcmpl-1",
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(config, mockFetch(fn));
      await client.chat("hi");
    });

    it("sets done to true when finish_reason is stop", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.done).toBe(true);
    });

    it("sets done to true when finish_reason is length", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            model: "gpt-4",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "length" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.done).toBe(true);
    });

    it("sets done to false for other finish_reasons", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            model: "gpt-4",
            choices: [
              { message: { role: "assistant", content: "ok" }, finish_reason: "content_filter" },
            ],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.done).toBe(false);
    });

    it("throws ModelError unavailable on network failure", async () => {
      const fn = vi.fn(async () => {
        throw new TypeError("fetch failed");
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("unavailable");
      }
    });

    it("throws ModelError invalid_response on non-OK response", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response("error", { status: 401 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("invalid_response");
        expect((err as ModelError).message).toContain("401");
      }
    });

    it("throws ModelError invalid_response on JSON parse failure", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response("not json", { status: 200 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("invalid_response");
      }
    });

    it("throws ModelError invalid_response when choices are missing", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ model: "gpt-4" }), { status: 200 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("invalid_response");
      }
    });

    it("uses config model when response model is missing", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        );
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.model).toBe("gpt-4");
    });
  });

  describe("isAvailable", () => {
    it("returns true when service responds OK", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(null, { status: 200 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(true);
      expect(fn).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns false when service responds non-OK", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(null, { status: 500 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it("follows 301 redirects on isAvailable", async () => {
      const responses: Record<string, () => Response> = {
        "https://api.openai.com/v1/models": () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://api.openai.com/v1/models/" },
          }),
        "https://api.openai.com/v1/models/": () => new Response(null, { status: 200 }),
      };
      const fn = vi.fn(async (url: string | URL | Request) => {
        const key = url.toString();
        const responder = responses[key];
        if (!responder) {
          throw new Error(`unexpected URL: ${key}`);
        }
        return responder();
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it("returns false on network error", async () => {
      const fn = vi.fn(async () => {
        throw new Error("connection refused");
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it("sends Authorization header when apiKey is provided", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("Bearer test-key");
        return new Response(null, { status: 200 });
      });

      const client = new OpenAICompatClient(defaultConfig, mockFetch(fn));
      await client.isAvailable();
    });
  });
});
