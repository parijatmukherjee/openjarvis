import { describe, it, expect } from "vitest";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import type { Intent, JarvisContext } from "../../src/nexus/types.js";

describe("RuleBasedRouter", () => {
  const router = new RuleBasedRouter();
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("routes 'search' intent to research agent", () => {
    const intent: Intent = {
      action: "search",
      params: { query: "weather" },
      confidence: 0.9,
      ambiguous: false,
    };
    const plan = router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
    expect(plan.parallel).toHaveLength(0);
    expect(plan.sequential).toHaveLength(0);
  });

  it("routes 'get_updates' intent to parallel weather + calendar", () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const plan = router.route(intent, context);
    expect(plan.parallel).toHaveLength(2);
    expect(plan.parallel.map((r) => r.agentId)).toContain("weather");
    expect(plan.parallel.map((r) => r.agentId)).toContain("calendar");
  });

  it("routes 'open_app' intent to system agent", () => {
    const intent: Intent = {
      action: "open_app",
      params: { app: "Calendar" },
      confidence: 0.95,
      ambiguous: false,
    };
    const plan = router.route(intent, context);
    expect(plan.primary?.agentId).toBe("system");
  });

  it("returns empty plan for unknown intent", () => {
    const intent: Intent = { action: "unknown", params: {}, confidence: 0.3, ambiguous: true };
    const plan = router.route(intent, context);
    expect(plan.primary).toBeUndefined();
    expect(plan.parallel).toHaveLength(0);
    expect(plan.sequential).toHaveLength(0);
  });
});
