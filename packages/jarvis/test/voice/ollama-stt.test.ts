import { describe, it, expect, vi } from "vitest";
import { OllamaSttEngine, SttError } from "../../src/voice/ollama-stt.js";

function pcmStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function mockFetch(
  fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch {
  return fn;
}

describe("OllamaSttEngine", () => {
  describe("default config", () => {
    it("uses default baseUrl and model", () => {
      const engine = new OllamaSttEngine();
      expect(engine).toBeInstanceOf(OllamaSttEngine);
    });

    it("accepts custom config", () => {
      const engine = new OllamaSttEngine({
        baseUrl: "http://custom:1234",
        model: "custom-model",
      });
      expect(engine).toBeInstanceOf(OllamaSttEngine);
    });
  });

  describe("successful transcription", () => {
    it("sends WAV data and returns transcribed text", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ text: "hello world" }), { status: 200 });
      });
      const engine = new OllamaSttEngine({ fetch: mockFetch(fn) });
      const result = await engine.transcribe(pcmStream(new Uint8Array(1024)));

      expect(result).toBe("hello world");
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith(
        "http://localhost:11434/api/transcribe",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("uses custom baseUrl and model", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ text: "custom" }), { status: 200 });
      });

      const engine = new OllamaSttEngine({
        baseUrl: "http://custom:1234",
        model: "custom-model",
        fetch: mockFetch(fn),
      });
      await engine.transcribe(pcmStream(new Uint8Array(512)));

      expect(fn).toHaveBeenCalledWith("http://custom:1234/api/transcribe", expect.anything());
    });

    it("returns empty string when text field is missing", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const engine = new OllamaSttEngine({ fetch: mockFetch(fn) });
      const result = await engine.transcribe(pcmStream(new Uint8Array(256)));
      expect(result).toBe("");
    });
  });

  describe("Ollama unavailable", () => {
    it("throws SttError with ollama_unavailable on connection failure", async () => {
      const fn = vi.fn(async () => {
        throw new TypeError("fetch failed");
      });

      const engine = new OllamaSttEngine({ fetch: mockFetch(fn) });

      try {
        await engine.transcribe(pcmStream(new Uint8Array(256)));
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SttError);
        expect((err as SttError).code).toBe("ollama_unavailable");
      }
    });
  });

  describe("transcription failure", () => {
    it("throws SttError with transcription_failed on non-2xx response", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ error: "model not found" }), { status: 500 });
      });

      const engine = new OllamaSttEngine({ fetch: mockFetch(fn) });

      try {
        await engine.transcribe(pcmStream(new Uint8Array(256)));
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SttError);
        expect((err as SttError).code).toBe("transcription_failed");
      }
    });

    it("includes HTTP status in error message", async () => {
      const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response("Unprocessable Entity", { status: 422 });
      });

      const engine = new OllamaSttEngine({ fetch: mockFetch(fn) });

      try {
        await engine.transcribe(pcmStream(new Uint8Array(256)));
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SttError);
        expect((err as SttError).code).toBe("transcription_failed");
        expect((err as SttError).message).toContain("422");
      }
    });
  });
});
