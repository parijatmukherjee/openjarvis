import type {
  ModelConfig,
  ModelClient,
  ModelErrorCode,
  ModelResponse,
  ModelResponseChunk,
} from "./types.js";
import { ModelError } from "./error.js";

export class OllamaClient implements ModelClient {
  private readonly config: ModelConfig;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: ModelConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    const messages: Array<{ role: string; content: string }> = [];
    if (system !== undefined) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey !== undefined) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.config.model, messages, stream: false }),
      });
    } catch (err: unknown) {
      throw new ModelError(
        "unavailable",
        `Cannot connect to Ollama at ${this.config.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new ModelError(
        "invalid_response",
        `Ollama chat failed (HTTP ${response.status}): ${await response.text().catch(() => "")}`,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ModelError("invalid_response", "Ollama returned invalid JSON");
    }

    const body = json as {
      model?: string;
      message?: { role?: string; content?: string };
      done?: boolean;
    };
    if (body.message?.content === undefined) {
      throw new ModelError("invalid_response", "Ollama response missing message content");
    }

    return {
      content: body.message.content,
      model: body.model ?? this.config.model,
      done: body.done ?? true,
    };
  }

  async isAvailable(): Promise<boolean> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey !== undefined) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await this.fetchFn(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async *chatStream(
    prompt: string,
    system?: string,
    signal?: AbortSignal,
  ): AsyncIterable<ModelResponseChunk> {
    const messages: Array<{ role: string; content: string }> = [];
    if (system !== undefined) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey !== undefined) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.config.model, messages }),
      };
      if (signal !== undefined) {
        init.signal = signal;
      }
      response = await this.fetchFn(`${this.config.baseUrl}/api/chat`, init);
    } catch (err: unknown) {
      const code: ModelErrorCode = "unavailable";
      const message = err instanceof Error ? err.message : String(err);
      yield { content: message, done: true, error: code };
      return;
    }

    if (!response.ok) {
      yield { content: "", done: true, error: "unavailable" };
      return;
    }

    if (!response.body) {
      yield { content: "", done: true, error: "invalid_response" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const buildDoneChunk = (content: string, model: string | undefined): ModelResponseChunk => {
      const chunk: ModelResponseChunk = { content, done: true };
      if (model !== undefined) {
        chunk.model = model;
      }
      return chunk;
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }
          const message = parsed.message as { content?: string } | undefined;
          const content = message?.content ?? "";
          const lineDone = parsed.done === true;
          const model = typeof parsed.model === "string" ? parsed.model : undefined;
          if (lineDone) {
            yield buildDoneChunk(content, model);
            return;
          }
          yield { content, done: false };
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer) as Record<string, unknown>;
          const message = parsed.message as { content?: string } | undefined;
          yield buildDoneChunk(
            message?.content ?? "",
            typeof parsed.model === "string" ? parsed.model : undefined,
          );
        } catch {
          // ignore trailing partial line
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
