import type {
  ModelConfig,
  ModelClient,
  ModelErrorCode,
  ModelResponse,
  ModelResponseChunk,
} from "./types.js";
import { ModelError } from "./error.js";

export class OpenAICompatClient implements ModelClient {
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
      response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.config.model, messages }),
        redirect: "follow",
      });
    } catch (err: unknown) {
      throw new ModelError(
        "unavailable",
        `Cannot connect to OpenAI-compat at ${this.config.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new ModelError(
        "invalid_response",
        `OpenAI-compat chat failed (HTTP ${response.status}): ${await response.text().catch(() => "")}`,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ModelError("invalid_response", "OpenAI-compat returned invalid JSON");
    }

    const body = json as {
      id?: string;
      model?: string;
      choices?: Array<{ message?: { role?: string; content?: string }; finish_reason?: string }>;
    };
    if (
      !Array.isArray(body.choices) ||
      body.choices.length === 0 ||
      body.choices[0]?.message?.content === undefined
    ) {
      throw new ModelError("invalid_response", "OpenAI-compat response missing message content");
    }

    const finishReason = body.choices[0].finish_reason;
    return {
      content: body.choices[0].message.content,
      model: body.model ?? this.config.model,
      done: finishReason === "stop" || finishReason === "length",
    };
  }

  async isAvailable(): Promise<boolean> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey !== undefined) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await this.fetchFn(`${this.config.baseUrl}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
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
        body: JSON.stringify({ model: this.config.model, messages, stream: true }),
      };
      if (signal !== undefined) {
        init.signal = signal;
      }
      response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, init);
    } catch (err: unknown) {
      const code: ModelErrorCode = "unavailable";
      const message = err instanceof Error ? err.message : String(err);
      yield { content: message, done: true, error: code };
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      yield { content: text, done: true, error: "unavailable" };
      return;
    }

    if (!response.body) {
      yield { content: "", done: true, error: "invalid_response" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.replace(/\r$/, "");
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            yield { content: "", done: true };
            return;
          }
          if (!payload) continue;
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(payload) as Record<string, unknown>;
          } catch {
            continue;
          }
          const choices = parsed.choices as
            | Array<{ delta?: { content?: string }; finish_reason?: string | null }>
            | undefined;
          const choice = choices?.[0];
          const content = choice?.delta?.content ?? "";
          const isDone = choice?.finish_reason !== undefined && choice.finish_reason !== null;
          const model = typeof parsed.model === "string" ? parsed.model : undefined;
          const chunk: ModelResponseChunk = { content, done: isDone };
          if (model !== undefined) {
            chunk.model = model;
          }
          yield chunk;
          if (isDone) return;
        }
      }
      if (buffer.trim()) {
        yield { content: "", done: true };
      }
    } finally {
      reader.releaseLock();
    }
  }
}
