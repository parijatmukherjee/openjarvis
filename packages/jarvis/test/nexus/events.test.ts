import { describe, it, expect } from "vitest";
import type { NexusEvent, IntentRoutedEvent, AgentDispatchedEvent } from "../../../src/nexus/events.js";

describe("NexusEvent types", () => {
  it("IntentRoutedEvent has correct shape", () => {
    const event: IntentRoutedEvent = {
      type: "intent_routed",
      intent: { action: "search", params: { query: "weather" }, confidence: 0.95, ambiguous: false },
      plan: { parallel: [], sequential: [], primary: { agentId: "research", confidence: 0.95, required: true } },
      sessionId: "sess-1",
      at: Date.now(),
    };
    expect(event.type).toBe("intent_routed");
    expect(event.intent.action).toBe("search");
  });

  it("AgentDispatchedEvent has correct shape", () => {
    const event: AgentDispatchedEvent = {
      type: "agent_dispatched",
      agentId: "research",
      route: { agentId: "research", confidence: 0.95, required: true, timeoutMs: 30000 },
      sessionId: "sess-1",
      at: Date.now(),
    };
    expect(event.agentId).toBe("research");
  });
});
