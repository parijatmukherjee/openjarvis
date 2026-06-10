import { describe, it, expect, vi } from "vitest";
import { NexusEngine } from "../../src/nexus/engine.js";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import { InProcessAgentPool } from "../../src/nexus/pool.js";
import { RuleBasedSynthesizer } from "../../src/nexus/synthesizer.js";
import { SimpleEventBus } from "../../src/event-bus/simple.js";
import type { Intent, JarvisContext } from "../../src/nexus/types.js";

describe("NexusEngine", () => {
  const eventBus = new SimpleEventBus();
  const engine = new NexusEngine({
    intentRouter: new RuleBasedRouter(),
    agentPool: new InProcessAgentPool(),
    synthesizer: new RuleBasedSynthesizer(),
    eventBus,
    maxConcurrentAgents: 5,
    defaultTimeoutMs: 30000,
  });

  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("executes a single-agent intent", async () => {
    const intent: Intent = { action: "search", params: { query: "weather" }, confidence: 0.9, ambiguous: false };
    const synthesis = await engine.execute(intent, context);
    expect(synthesis.spoken).toBeDefined();
    expect(synthesis.spoken.length).toBeGreaterThan(0);
  });

  it("executes parallel dispatch for get_updates", async () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const synthesis = await engine.execute(intent, context);
    expect(synthesis.spoken).toMatch(/degrees/);
    expect(synthesis.spoken).toMatch(/Meeting/);
  });

  it("emits events during execution", async () => {
    const events: string[] = [];
    eventBus.subscribe("nexus", (event) => {
      events.push((event.payload as { type: string }).type);
    });

    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    await engine.execute(intent, context);

    expect(events).toContain("intent_routed");
    expect(events).toContain("agent_dispatched");
    expect(events).toContain("agent_completed");
    expect(events).toContain("results_collected");
    expect(events).toContain("synthesis_complete");
  });

  it("handles agent failure gracefully", async () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const pool = new InProcessAgentPool();
    const failingEngine = new NexusEngine({
      intentRouter: new RuleBasedRouter(),
      agentPool: pool,
      synthesizer: new RuleBasedSynthesizer(),
      eventBus,
      maxConcurrentAgents: 5,
      defaultTimeoutMs: 30000,
    });

    vi.spyOn(pool, "execute").mockImplementation(async (route) => {
      if (route.agentId === "weather") {
        return { agentId: "weather", success: false, error: "API down" };
      }
      return { agentId: route.agentId, success: true, output: { temp: 72 } };
    });

    const synthesis = await failingEngine.execute(intent, context);
    expect(synthesis.spoken).toMatch(/unavailable/);
  });
});
