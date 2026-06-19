import { describe, it, expect } from "vitest";
import { createModelClient } from "../../src/model/factory.js";
import { ModelError } from "../../src/model/error.js";
import { OllamaClient } from "../../src/model/ollama-client.js";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";

describe("createModelClient", () => {
  it("creates OllamaClient for ollama provider", () => {
    const client = createModelClient({
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://localhost:11434",
    });
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("creates OllamaClient for ollama-cloud provider (native Ollama API)", () => {
    const client = createModelClient({
      provider: "ollama-cloud",
      model: "gemma3:4b",
      baseUrl: "https://api.ollama.com",
      apiKey: "key",
    });
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("creates OpenAICompatClient for openai-compat provider", () => {
    const client = createModelClient({
      provider: "openai-compat",
      model: "gpt-4",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "key",
    });
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });
});

describe("ModelError", () => {
  it("has correct name and code", () => {
    const err = new ModelError("unavailable", "test message");
    expect(err.name).toBe("ModelError");
    expect(err.code).toBe("unavailable");
    expect(err.message).toBe("test message");
  });

  it("is an instance of Error", () => {
    const err = new ModelError("timeout", "timed out");
    expect(err).toBeInstanceOf(Error);
  });
});
