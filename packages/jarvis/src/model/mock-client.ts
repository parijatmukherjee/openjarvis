import type { ModelClient, ModelResponse, ModelResponseChunk } from "./types.js";
import { ModelError } from "./error.js";

export interface MockModelClientConfig {
  available?: boolean;
  response?: ModelResponse;
  error?: ModelError;
}

export class MockModelClient implements ModelClient {
  private readonly available: boolean;
  private readonly response: ModelResponse;
  private readonly error: ModelError | undefined;
  readonly chatCalls: Array<{ prompt: string; system?: string }>;

  constructor(config?: MockModelClientConfig) {
    this.available = config?.available ?? true;
    this.response = config?.response ?? { content: "mock response", model: "mock", done: true };
    this.error = config?.error;
    this.chatCalls = [];
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    const call: { prompt: string; system?: string } = { prompt };
    if (system !== undefined) {
      call.system = system;
    }
    this.chatCalls.push(call);
    if (this.error !== undefined) {
      throw this.error;
    }
    return this.response;
  }

  async *chatStream(prompt: string, system?: string): AsyncIterable<ModelResponseChunk> {
    const call: { prompt: string; system?: string } = { prompt };
    if (system !== undefined) {
      call.system = system;
    }
    this.chatCalls.push(call);
    if (this.error !== undefined) {
      yield {
        content: this.error.message,
        done: true,
        model: this.response.model,
        error: this.error.code,
      };
      return;
    }
    yield { content: this.response.content, done: true, model: this.response.model };
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}
