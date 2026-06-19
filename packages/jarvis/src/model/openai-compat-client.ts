import type { ModelConfig, ModelClient, ModelResponse, ModelResponseChunk } from "./types.js";
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

  // Stub; the real SSE implementation lives in Task 4.
  async *chatStream(_prompt: string, _system?: string): AsyncIterable<ModelResponseChunk> {
    yield { content: "", done: true };
  }
}
