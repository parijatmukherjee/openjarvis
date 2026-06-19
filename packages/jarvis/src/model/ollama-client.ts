import type { ModelConfig, ModelClient, ModelResponse } from "./types.js";
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

    const body = json as { model?: string; message?: { role?: string; content?: string }; done?: boolean };
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
}