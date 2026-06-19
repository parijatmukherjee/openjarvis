import type { ModelConfig, ModelClient } from "./types.js";
import { OllamaClient } from "./ollama-client.js";
import { OpenAICompatClient } from "./openai-compat-client.js";

export function createModelClient(config: ModelConfig): ModelClient {
  if (config.provider === "ollama") {
    return new OllamaClient(config);
  }
  return new OpenAICompatClient(config);
}