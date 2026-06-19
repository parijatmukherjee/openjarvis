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

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  isAvailable(): Promise<boolean>;
}