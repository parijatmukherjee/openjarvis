export type ModelErrorCode = "unavailable" | "timeout" | "invalid_response";

export type ModelProvider = "ollama" | "ollama-cloud" | "openai-compat";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface ModelResponseChunk {
  content: string;
  done: boolean;
  model?: string;
  error?: ModelErrorCode;
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  chatStream(prompt: string, system?: string): AsyncIterable<ModelResponseChunk>;
  isAvailable(): Promise<boolean>;
}
