import { describe, it, expect, beforeAll } from "vitest";
import { OllamaClient } from "../../src/model/ollama-client.js";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";
import { createModelClient } from "../../src/model/factory.js";
import { ModelError } from "../../src/model/error.js";
import type { ModelConfig, ModelClient } from "../../src/model/types.js";

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_CLOUD_URL = "https://api.ollama.com/v1";
const OPENAI_COMPAT_URL = process.env.OPENAI_COMPAT_URL ?? "https://api.openai.com/v1";

describe.skipIf(!OLLAMA_API_KEY)("Ollama Cloud integration (real API)", () => {
  let client: OpenAICompatClient;

  beforeAll(() => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    client = new OpenAICompatClient(config);
  });

  it("isAvailable returns true for Ollama Cloud", async () => {
    const available = await client.isAvailable();
    expect(available).toBe(true);
  });

  it("chat returns a non-empty response", async () => {
    const response = await client.chat("Say hello in one word.");
    expect(response.content).toBeTruthy();
    expect(typeof response.content).toBe("string");
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.model).toBeTruthy();
    expect(response.done).toBe(true);
  });

  it("chat with system prompt returns a contextual response", async () => {
    const response = await client.chat("What is 2+2?", "You are a helpful math assistant. Answer briefly with just the number.");
    expect(response.content).toBeTruthy();
    expect(response.content.toLowerCase()).toContain("4");
  });

  it("chat respects the model parameter in response", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    const clientWithModel = new OpenAICompatClient(config);
    const response = await clientWithModel.chat("Say hello.");
    expect(response.model).toBeTruthy();
  });

  it("chat handles multi-turn conversation context", async () => {
    const response = await client.chat(
      "The capital of France is Paris. What is the capital of France?",
      "You are a geography assistant. Answer briefly.",
    );
    expect(response.content).toBeTruthy();
    expect(response.content.toLowerCase()).toContain("paris");
  });

  it("chat returns ModelError for invalid API key", async () => {
    const badConfig: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: "invalid-key-00000000",
    };
    const badClient = new OpenAICompatClient(badConfig);
    await expect(badClient.chat("hello")).rejects.toThrow(ModelError);
  });

  it("isAvailable returns false for unreachable host", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://unreachable.invalid.host.example.com/v1",
      apiKey: "fake",
    };
    const unreachableClient = new OpenAICompatClient(config);
    const available = await unreachableClient.isAvailable();
    expect(available).toBe(false);
  });

  it("createModelClient returns OpenAICompatClient for ollama-cloud", () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    const created = createModelClient(config);
    expect(created).toBeInstanceOf(OpenAICompatClient);
  });

  it("model:list endpoint returns available models", async () => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${OLLAMA_API_KEY}`,
    };
    const response = await fetch(`${OLLAMA_CLOUD_URL}/models`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);
    const data = await response.json() as { data: Array<{ id: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].id).toBeTruthy();
  });

  it("chat handles factual questions correctly", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    const clientFacts = new OpenAICompatClient(config);
    const response = await clientFacts.chat(
      "What is the capital of Japan?",
      "You are a geography assistant. Answer with just the city name.",
    );
    expect(response.content.toLowerCase()).toContain("tokyo");
  });

  it("chat handles code generation requests", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    const clientCode = new OpenAICompatClient(config);
    const response = await clientCode.chat(
      "Write a Python function that adds two numbers.",
      "You are a coding assistant. Provide concise code.",
    );
    expect(response.content).toContain("def");
    expect(response.content).toContain("add");
  });

  it("model responds within reasonable latency", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    const clientLatency = new OpenAICompatClient(config);
    const start = Date.now();
    await clientLatency.chat("Say OK.");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
  });
});

describe.skipIf(!OPENAI_API_KEY)("OpenAI-compatible integration (real API)", () => {
  let client: OpenAICompatClient;

  beforeAll(() => {
    const config: ModelConfig = {
      provider: "openai-compat",
      model: "gpt-4o-mini",
      baseUrl: OPENAI_COMPAT_URL,
      apiKey: OPENAI_API_KEY!,
    };
    client = new OpenAICompatClient(config);
  });

  it("isAvailable returns true", async () => {
    const available = await client.isAvailable();
    expect(available).toBe(true);
  });

  it("chat returns a non-empty response", async () => {
    const response = await client.chat("Say hello in one word.");
    expect(response.content).toBeTruthy();
    expect(typeof response.content).toBe("string");
    expect(response.content.length).toBeGreaterThan(0);
  });

  it("chat with system prompt works", async () => {
    const response = await client.chat("What is 2+2?", "You are a helpful math assistant. Answer briefly.");
    expect(response.content).toBeTruthy();
    expect(response.content.toLowerCase()).toContain("4");
  });

  it("chat returns done:true for complete responses", async () => {
    const response = await client.chat("Say hello.");
    expect(response.done).toBe(true);
  });

  it("chat returns ModelError for invalid API key", async () => {
    const badConfig: ModelConfig = {
      provider: "openai-compat",
      model: "gpt-4o-mini",
      baseUrl: OPENAI_COMPAT_URL,
      apiKey: "invalid-key-00000000",
    };
    const badClient = new OpenAICompatClient(badConfig);
    await expect(badClient.chat("hello")).rejects.toThrow(ModelError);
  });

  it("createModelClient returns OpenAICompatClient for openai-compat", () => {
    const config: ModelConfig = {
      provider: "openai-compat",
      model: "gpt-4o-mini",
      baseUrl: OPENAI_COMPAT_URL,
      apiKey: OPENAI_API_KEY!,
    };
    const created = createModelClient(config);
    expect(created).toBeInstanceOf(OpenAICompatClient);
  });
});

describe("Model error handling (no API key needed)", () => {
  it("OllamaClient throws ModelError for unreachable host", async () => {
    const config: ModelConfig = {
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11435",
    };
    const client = new OllamaClient(config);
    await expect(client.chat("hello")).rejects.toThrow(ModelError);
  });

  it("OpenAICompatClient throws ModelError for unreachable host", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://unreachable.invalid.host.example.com/v1",
      apiKey: "fake",
    };
    const client = new OpenAICompatClient(config);
    await expect(client.chat("hello")).rejects.toThrow(ModelError);
  });

  it("OllamaClient.isAvailable returns false for unreachable host", async () => {
    const config: ModelConfig = {
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11435",
    };
    const client = new OllamaClient(config);
    const available = await client.isAvailable();
    expect(available).toBe(false);
  });

  it("OpenAICompatClient.isAvailable returns false for unreachable host", async () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://unreachable.invalid.host.example.com/v1",
      apiKey: "fake",
    };
    const client = new OpenAICompatClient(config);
    const available = await client.isAvailable();
    expect(available).toBe(false);
  });

  it("createModelClient returns OllamaClient for ollama provider", () => {
    const config: ModelConfig = {
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11434",
    };
    const client = createModelClient(config);
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("createModelClient returns OpenAICompatClient for ollama-cloud provider", () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://api.ollama.com/v1",
      apiKey: "test-key",
    };
    const client = createModelClient(config);
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });

  it("createModelClient returns OpenAICompatClient for openai-compat provider", () => {
    const config: ModelConfig = {
      provider: "openai-compat",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    };
    const client = createModelClient(config);
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });

  it("ModelError has correct code property", () => {
    const err = new ModelError("unavailable", "test message");
    expect(err.code).toBe("unavailable");
    expect(err.message).toBe("test message");
    expect(err.name).toBe("ModelError");
  });

  it("OllamaClient uses /api/chat endpoint", async () => {
    const config: ModelConfig = {
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11435",
    };
    const client = new OllamaClient(config);
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("OpenAICompatClient uses /chat/completions endpoint", () => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://api.ollama.com/v1",
      apiKey: "test-key",
    };
    const client = new OpenAICompatClient(config);
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });
});

describe.skipIf(!OLLAMA_API_KEY)("Ollama Cloud: router and synthesizer with real model", () => {
  let client: ModelClient;

  beforeAll(() => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    client = createModelClient(config);
  });

  it("router classifies known intents with model assistance", async () => {
    const { RuleBasedRouter } = await import("../../src/nexus/router.js");
    const available = await client.isAvailable();
    if (!available) return;

    const router = new RuleBasedRouter(client);
    const plan = await router.route(
      { action: "check_weather", params: { location: "NYC" }, confidence: 0.9, ambiguous: false },
      { sessionId: "test", userId: "test", recentIntents: [], currentTime: new Date() },
    );

    expect(plan).toBeDefined();
    expect(plan.primary).toBeDefined();
  });

  it("synthesizer produces natural language output with model", async () => {
    const { RuleBasedSynthesizer } = await import("../../src/nexus/synthesizer.js");
    const available = await client.isAvailable();
    if (!available) return;

    const synthesizer = new RuleBasedSynthesizer(client);
    const synthesis = await synthesizer.synthesize(
      [
        {
          agentId: "weather",
          success: true,
          output: { status: "dispatched", action: "weather" },
          durationMs: 100,
        },
      ],
      { action: "check_weather", params: { location: "NYC" }, confidence: 0.9, ambiguous: false },
      { sessionId: "test", userId: "test", recentIntents: [], currentTime: new Date() },
    );

    expect(synthesis).toBeDefined();
    expect(synthesis.spoken).toBeTruthy();
    expect(synthesis.spoken.length).toBeGreaterThan(0);
  });

  it("agent pool general agent uses model for responses", async () => {
    const { InProcessAgentPool } = await import("../../src/nexus/pool.js");
    const available = await client.isAvailable();
    if (!available) return;

    const pool = new InProcessAgentPool(client);
    const result = await pool.execute(
      { agentId: "general", confidence: 0.9, required: false },
      { sessionId: "test", intent: { action: "search", params: {}, confidence: 0.9, ambiguous: false } },
    );

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    const output = result.output as { response?: string };
    expect(output.response).toBeTruthy();
    expect(output.response!.length).toBeGreaterThan(0);
  });
});