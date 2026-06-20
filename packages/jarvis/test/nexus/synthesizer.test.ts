import { describe, it, expect } from "vitest";
import { RuleBasedSynthesizer } from "../../src/nexus/synthesizer.js";
import type { AgentResult, Intent, JarvisContext } from "../../src/nexus/types.js";
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";

describe("RuleBasedSynthesizer", () => {
  const synthesizer = new RuleBasedSynthesizer();
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("synthesizes weather result", async () => {
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/72/);
    expect(synthesis.spoken).toMatch(/sunny/);
  });

  it("synthesizes parallel weather + calendar results", async () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
      {
        agentId: "calendar",
        success: true,
        output: { events: [{ title: "Meeting", time: "10:00" }] },
      },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/72/);
    expect(synthesis.spoken).toMatch(/Meeting/);
    expect(synthesis.visual).toBeDefined();
    expect(synthesis.visual!.length).toBeGreaterThan(0);
  });

  it("handles failed agent gracefully", async () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
      { agentId: "calendar", success: false, error: "Calendar unavailable" },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/sunny/);
    expect(synthesis.spoken).toMatch(/unavailable/);
  });
});

describe("RuleBasedSynthesizer with ModelClient", () => {
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("uses model for synthesis when available", async () => {
    const client = new MockModelClient({
      response: { content: "It is sunny and 72 degrees.", model: "mock", done: true },
    });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toBe("It is sunny and 72 degrees.");
  });

  it("falls back to rule-based synthesis when model is unavailable", async () => {
    const client = new MockModelClient({ available: false });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/sunny/);
    expect(synthesis.spoken).toMatch(/72/);
  });

  it("falls back to rule-based synthesis when model throws", async () => {
    const client = new MockModelClient({
      error: new ModelError("unavailable", "model unavailable"),
    });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/sunny/);
    expect(synthesis.spoken).toMatch(/72/);
  });

  it("chat() passes a persona-aware system prompt to the model", async () => {
    const client = new MockModelClient({
      response: { content: "synthesized", model: "mock", done: true },
    });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const ctx: JarvisContext = {
      sessionId: "sess-1",
      userId: "alice",
      recentIntents: [
        { action: "check_weather", params: {}, confidence: 1, ambiguous: false },
        { action: "list_events", params: {}, confidence: 1, ambiguous: false },
      ],
      currentTime: new Date(),
    };
    await synthesizer.synthesize(results, intent, ctx);
    expect(client.chatCalls).toHaveLength(1);
    const system = client.chatCalls[0].system ?? "";
    expect(system).toContain("JARVIS");
    expect(system).toContain("User: alice");
    expect(system).toContain("Synthesize the following agent results");
    expect(system).toContain("Recent actions: list_events, check_weather");
  });

  it("chatStream() passes a persona-aware system prompt to the model", async () => {
    const client = new MockModelClient({
      response: { content: "streamed synthesis", model: "mock", done: true },
    });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "check_weather",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const ctx: JarvisContext = {
      sessionId: "sess-1",
      userId: "bob",
      recentIntents: [],
      currentTime: new Date(),
    };
    const chunks: string[] = [];
    const synthesis = await synthesizer.synthesize(results, intent, ctx, {
      onChunk: (chunk) => chunks.push(chunk.text),
    });
    expect(synthesis.spoken).toContain("streamed synthesis");
    expect(client.chatCalls).toHaveLength(1);
    const system = client.chatCalls[0].system ?? "";
    expect(system).toContain("JARVIS");
    expect(system).toContain("User: bob");
    expect(system).toContain("Synthesize the following agent results");
  });

  it("synthesizer surfaces recent intents in the system prompt", async () => {
    const client = new MockModelClient({
      response: { content: "ok", model: "mock", done: true },
    });
    const synthesizer = new RuleBasedSynthesizer(client);
    const intent: Intent = {
      action: "get_updates",
      params: {},
      confidence: 0.9,
      ambiguous: false,
    };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const ctx: JarvisContext = {
      sessionId: "sess-1",
      userId: "carol",
      recentIntents: [
        { action: "open_app", params: {}, confidence: 1, ambiguous: false },
        { action: "search_web", params: {}, confidence: 1, ambiguous: false },
        { action: "check_calendar", params: {}, confidence: 1, ambiguous: false },
        { action: "send_email", params: {}, confidence: 1, ambiguous: false },
      ],
      currentTime: new Date(),
    };
    await synthesizer.synthesize(results, intent, ctx);
    expect(client.chatCalls).toHaveLength(1);
    const system = client.chatCalls[0].system ?? "";
    expect(system).toContain("Recent actions:");
    expect(system).toContain("check_calendar");
    expect(system).toContain("search_web");
    expect(system).toContain("send_email");
    expect(system).not.toContain("open_app");
  });
});
