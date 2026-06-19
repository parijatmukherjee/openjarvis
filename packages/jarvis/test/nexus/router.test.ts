import { describe, it, expect } from "vitest";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import type { Intent, JarvisContext } from "../../src/nexus/types.js";
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";

describe("RuleBasedRouter", () => {
  const router = new RuleBasedRouter();
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("routes 'search' intent to research agent", async () => {
    const intent: Intent = {
      action: "search",
      params: { query: "weather" },
      confidence: 0.9,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
    expect(plan.parallel).toHaveLength(0);
    expect(plan.sequential).toHaveLength(0);
  });

  it("routes 'get_updates' intent to parallel weather + calendar", async () => {
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.parallel).toHaveLength(2);
    expect(plan.parallel.map((r) => r.agentId)).toContain("weather");
    expect(plan.parallel.map((r) => r.agentId)).toContain("calendar");
  });

  it("routes 'open_app' intent to system agent", async () => {
    const intent: Intent = {
      action: "open_app",
      params: { app: "Calendar" },
      confidence: 0.95,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("system");
  });

  it("routes 'cron_schedule' intent to cron agent", async () => {
    const intent: Intent = {
      action: "cron_schedule",
      params: {},
      confidence: 0.85,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("cron");
    expect(plan.primary?.required).toBe(false);
  });

  it("routes 'cron_list' intent to cron agent", async () => {
    const intent: Intent = { action: "cron_list", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("cron");
  });

  it("routes 'cron_cancel' intent to cron agent", async () => {
    const intent: Intent = {
      action: "cron_cancel",
      params: { jobId: "abc" },
      confidence: 0.9,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("cron");
  });

  it("routes 'secret_get' intent to secrets agent as required", async () => {
    const intent: Intent = {
      action: "secret_get",
      params: { key: "API_KEY" },
      confidence: 0.95,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("secrets");
    expect(plan.primary?.required).toBe(true);
  });

  it("routes 'search_discord' intent to discord agent", async () => {
    const intent: Intent = {
      action: "search_discord",
      params: { query: "test" },
      confidence: 0.9,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("discord");
    expect(plan.primary?.required).toBe(true);
  });

  it("routes 'get_calendar' intent to calendar agent", async () => {
    const intent: Intent = {
      action: "get_calendar",
      params: {},
      confidence: 0.85,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("calendar");
  });

  it("routes 'set_reminder' intent to cron agent", async () => {
    const intent: Intent = {
      action: "set_reminder",
      params: {},
      confidence: 0.85,
      ambiguous: false,
    };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("cron");
  });

  it("routes unknown intent to general agent", async () => {
    const intent: Intent = { action: "unknown", params: {}, confidence: 0.3, ambiguous: true };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("general");
    expect(plan.primary?.confidence).toBe(0.3);
    expect(plan.primary?.required).toBe(false);
    expect(plan.parallel).toHaveLength(0);
    expect(plan.sequential).toHaveLength(0);
  });
});

describe("RuleBasedRouter with ModelClient", () => {
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("uses model classification when available and returns valid intent", async () => {
    const client = new MockModelClient({
      response: { content: '{"action": "search", "confidence": 0.9}', model: "mock", done: true },
    });
    const router = new RuleBasedRouter(client);
    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
    expect(client.chatCalls.length).toBe(1);
  });

  it("falls back to rules when model is unavailable", async () => {
    const client = new MockModelClient({ available: false });
    const router = new RuleBasedRouter(client);
    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
  });

  it("falls back to rules when model returns invalid JSON", async () => {
    const client = new MockModelClient({
      response: { content: "not json", model: "mock", done: true },
    });
    const router = new RuleBasedRouter(client);
    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
  });

  it("falls back to rules when model classification confidence is too low", async () => {
    const client = new MockModelClient({
      response: { content: '{"action": "search", "confidence": 0.3}', model: "mock", done: true },
    });
    const router = new RuleBasedRouter(client);
    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
  });

  it("falls back to rules when model throws", async () => {
    const client = new MockModelClient({
      error: new ModelError("unavailable", "model unavailable"),
    });
    const router = new RuleBasedRouter(client);
    const intent: Intent = { action: "search", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("research");
  });
});