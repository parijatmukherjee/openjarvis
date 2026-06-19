import { describe, it, expect, vi } from "vitest";
import { OllamaClient } from "../../src/model/ollama-client.js";
import { ModelError } from "../../src/model/error.js";
import type { ModelConfig, ModelResponseChunk } from "../../src/model/types.js";

function mockFetch(
  fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch {
  return fn;
}

const defaultConfig: ModelConfig = {
  provider: "ollama",
  model: "llama3",
  baseUrl: "http://localhost:11434",
};

describe("OllamaClient", () => {
  describe("chat", () => {
    it("sends prompt and returns response", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            model: "llama3",
            message: { role: "assistant", content: "hello" },
            done: true,
          }),
          { status: 200 },
        );
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");

      expect(result).toEqual({ content: "hello", model: "llama3", done: true });
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith(
        "http://localhost:11434/api/chat",
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
            model: "llama3",
            message: { role: "assistant", content: "ok" },
            done: true,
          }),
          { status: 200 },
        );
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      await client.chat("hi", "You are helpful");
    });

    it("sends Authorization header when apiKey is provided", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("Bearer my-key");
        return new Response(
          JSON.stringify({
            model: "llama3",
            message: { role: "assistant", content: "ok" },
            done: true,
          }),
          { status: 200 },
        );
      });

      const client = new OllamaClient({ ...defaultConfig, apiKey: "my-key" }, mockFetch(fn));
      await client.chat("hi");
    });

    it("throws ModelError unavailable on network failure", async () => {
      const fn = vi.fn(async () => {
        throw new TypeError("fetch failed");
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
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
        return new Response("error", { status: 500 });
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("invalid_response");
        expect((err as ModelError).message).toContain("500");
      }
    });

    it("throws ModelError invalid_response on JSON parse failure", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response("not json", { status: 200 });
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      try {
        await client.chat("hi");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModelError);
        expect((err as ModelError).code).toBe("invalid_response");
      }
    });

    it("throws ModelError invalid_response when message content is missing", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ model: "llama3" }), { status: 200 });
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
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
          JSON.stringify({ message: { role: "assistant", content: "ok" }, done: true }),
          { status: 200 },
        );
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      const result = await client.chat("hi");
      expect(result.model).toBe("llama3");
    });
  });

  describe("isAvailable", () => {
    it("returns true when service responds OK", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(null, { status: 200 });
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(true);
      expect(fn).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns false when service responds non-OK", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(null, { status: 500 });
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      const fn = vi.fn(async () => {
        throw new Error("connection refused");
      });

      const client = new OllamaClient(defaultConfig, mockFetch(fn));
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it("sends Authorization header when apiKey is provided", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("Bearer my-key");
        return new Response(null, { status: 200 });
      });

      const client = new OllamaClient({ ...defaultConfig, apiKey: "my-key" }, mockFetch(fn));
      await client.isAvailable();
    });
  });
});

describe("ModelClient interface (chatStream)", () => {
  it("OllamaClient has a chatStream method declared by the interface", () => {
    // Stub implementation is added in Task 1; real NDJSON parser arrives in Task 3.
    const client = new OllamaClient(defaultConfig);
    expect(typeof client.chatStream).toBe("function");
  });
});

describe("OllamaClient.chatStream", () => {
  function makeNDJSONResponse(chunks: object[]): Response {
    const body = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
    return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }
  it("yields one chunk per NDJSON line", async () => {
    const fetchMock = vi.fn(async () =>
      makeNDJSONResponse([
        { model: "llama3", message: { role: "assistant", content: "The" }, done: false },
        { model: "llama3", message: { role: "assistant", content: " sky" }, done: false },
        { model: "llama3", message: { role: "assistant", content: " is" }, done: false },
        {
          model: "llama3",
          message: { role: "assistant", content: " blue" },
          done: true,
          total_duration: 100,
        },
      ]),
    );
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([
      { content: "The", done: false },
      { content: " sky", done: false },
      { content: " is", done: false },
      { content: " blue", done: true, model: "llama3" },
    ]);
  });

  it("yields a final error chunk on HTTP 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 503 }));
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([{ content: "", done: true, error: "unavailable" }]);
  });

  it("passes AbortSignal to fetch", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      makeNDJSONResponse([{ done: true }]),
    );
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const ctrl = new AbortController();
    for await (const _ of client.chatStream("hi", undefined, ctrl.signal)) {
      /* noop */
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(call?.signal).toBe(ctrl.signal);
  });
});
