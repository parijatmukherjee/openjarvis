import { describe, it, expect, beforeAll } from "vitest";
import { NexusEngine } from "../../src/nexus/engine.js";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import { InProcessAgentPool } from "../../src/nexus/pool.js";
import { RuleBasedSynthesizer } from "../../src/nexus/synthesizer.js";
import { SimpleEventBus } from "../../src/event-bus/simple.js";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";
import { createModelClient } from "../../src/model/factory.js";
import type { ModelConfig } from "../../src/model/types.js";
import type { Intent, JarvisContext } from "../../src/nexus/types.js";

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_CLOUD_URL = "https://api.ollama.com/v1";

function makeContext(): JarvisContext {
  return {
    sessionId: `test-session-${Date.now()}`,
    userId: "integration-test-user",
    recentIntents: [],
    currentTime: new Date(),
  };
}

describe.skipIf(!OLLAMA_API_KEY)("NexusEngine with Ollama Cloud model", () => {
  let client: OpenAICompatClient;
  let eventBus: SimpleEventBus;
  let engine: NexusEngine;

  beforeAll(() => {
    const config: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: OLLAMA_CLOUD_URL,
      apiKey: OLLAMA_API_KEY!,
    };
    client = createModelClient(config) as OpenAICompatClient;
    eventBus = new SimpleEventBus();
    engine = new NexusEngine({
      intentRouter: new RuleBasedRouter(client),
      agentPool: new InProcessAgentPool(client),
      synthesizer: new RuleBasedSynthesizer(client),
      eventBus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 60000,
    });
  });

  it("executes a check_weather intent through the full pipeline", async () => {
    const intent: Intent = {
      action: "check_weather",
      params: { location: "NYC" },
      confidence: 0.9,
      ambiguous: false,
    };
    const result = await engine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
    expect(result.spoken.length).toBeGreaterThan(0);
  });

  it("executes a search intent through the full pipeline", async () => {
    const intent: Intent = {
      action: "search",
      params: { query: "weather" },
      confidence: 0.9,
      ambiguous: false,
    };
    const result = await engine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
  });

  it("executes a get_updates intent with parallel dispatch", async () => {
    const intent: Intent = {
      action: "get_updates",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const result = await engine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
    expect(result.spoken.length).toBeGreaterThan(0);
  });

  it("emits lifecycle events during execution", async () => {
    const events: string[] = [];
    const localBus = new SimpleEventBus();
    localBus.subscribe("nexus", (event) => {
      events.push((event.payload as { type: string }).type);
    });

    const localEngine = new NexusEngine({
      intentRouter: new RuleBasedRouter(client),
      agentPool: new InProcessAgentPool(client),
      synthesizer: new RuleBasedSynthesizer(client),
      eventBus: localBus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 60000,
    });

    const intent: Intent = {
      action: "search",
      params: { query: "test" },
      confidence: 0.9,
      ambiguous: false,
    };
    await localEngine.execute(intent, makeContext());

    expect(events).toContain("intent_routed");
    expect(events).toContain("results_collected");
    expect(events).toContain("synthesis_complete");
  });

  it("handles ambiguous intent gracefully", async () => {
    const intent: Intent = {
      action: "unknown_intent",
      params: {},
      confidence: 0.3,
      ambiguous: true,
    };
    const result = await engine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
  });

  it("falls back gracefully when model is unavailable", async () => {
    const badConfig: ModelConfig = {
      provider: "ollama-cloud",
      model: "llama3.2",
      baseUrl: "https://unreachable.invalid.host.example.com",
      apiKey: "fake-key",
    };
    const badClient = createModelClient(badConfig);
    const badBus = new SimpleEventBus();
    const badEngine = new NexusEngine({
      intentRouter: new RuleBasedRouter(badClient),
      agentPool: new InProcessAgentPool(badClient),
      synthesizer: new RuleBasedSynthesizer(badClient),
      eventBus: badBus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 30000,
    });

    const intent: Intent = {
      action: "check_weather",
      params: { location: "NYC" },
      confidence: 0.9,
      ambiguous: false,
    };
    const result = await badEngine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
  });

  it("creates OpenAICompatClient for ollama-cloud provider", () => {
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });

  it("model client is available on Ollama Cloud", async () => {
    const available = await client.isAvailable();
    expect(available).toBe(true);
  });

  it("model-assisted routing classifies known intents", async () => {
    const available = await client.isAvailable();
    if (!available) return;

    const router = new RuleBasedRouter(client);
    const plan = await router.route(
      { action: "check_weather", params: { location: "NYC" }, confidence: 0.9, ambiguous: false },
      makeContext(),
    );

    expect(plan).toBeDefined();
    expect(plan.primary).toBeDefined();
  });

  it("model-assisted synthesis produces natural language output", async () => {
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
      makeContext(),
    );

    expect(synthesis).toBeDefined();
    expect(synthesis.spoken).toBeTruthy();
    expect(synthesis.spoken.length).toBeGreaterThan(0);
  });

  it("general agent uses model for responses", async () => {
    const intent: Intent = {
      action: "general",
      params: { query: "What is the capital of France?" },
      confidence: 0.9,
      ambiguous: false,
    };
    const result = await engine.execute(intent, makeContext());

    expect(result).toBeDefined();
    expect(result.spoken).toBeTruthy();
  });
});