import { describe, it, expect } from "vitest";
import { InProcessAgentPool } from "../../src/nexus/pool.js";
import type { AgentRoute, AgentContext } from "../../src/nexus/types.js";
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";

describe("InProcessAgentPool", () => {
  const pool = new InProcessAgentPool();
  const context: AgentContext = {
    sessionId: "sess-1",
    intent: { action: "search", params: {}, confidence: 0.9, ambiguous: false },
  };

  it("lists available agents", async () => {
    const agents = await pool.list();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]).toHaveProperty("id");
    expect(agents[0]).toHaveProperty("name");
  });

  it("executes a mock agent and returns result", async () => {
    const route: AgentRoute = { agentId: "research", confidence: 0.9, required: true };
    const result = await pool.execute(route, context);
    expect(result.agentId).toBe("research");
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it("handles timeout gracefully", async () => {
    const route: AgentRoute = { agentId: "slow", confidence: 0.9, required: false, timeoutMs: 50 };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout/i);
  });

  it("returns unknown agent as failed", async () => {
    const route: AgentRoute = { agentId: "nonexistent", confidence: 0.9, required: false };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown agent/i);
  });
});

describe("InProcessAgentPool with ModelClient", () => {
  const context: AgentContext = {
    sessionId: "sess-1",
    intent: { action: "search", params: {}, confidence: 0.9, ambiguous: false },
  };

  it("uses model for general agent when available", async () => {
    const client = new MockModelClient({
      response: { content: "AI response", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect((result.output as { response: string }).response).toBe("AI response");
  });

  it("falls back to acknowledgment when model is unavailable", async () => {
    const client = new MockModelClient({ available: false });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect((result.output as { response: string }).response).toBe("I'm here. How can I help?");
  });

  it("falls back to acknowledgment when model throws", async () => {
    const client = new MockModelClient({
      error: new ModelError("unavailable", "model unavailable"),
    });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect((result.output as { response: string }).response).toBe("I'm here. How can I help?");
  });

  it("non-general agents return dispatched status", async () => {
    const client = new MockModelClient({
      response: { content: "AI response", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "research", confidence: 0.9, required: true };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect((result.output as { status: string }).status).toBe("dispatched");
  });

  it("general agent passes a persona-aware system prompt to the model", async () => {
    const client = new MockModelClient({
      response: { content: "AI response", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const ctx: AgentContext = {
      sessionId: "sess-1",
      intent: { action: "general", params: { text: "hello" }, confidence: 1, ambiguous: false },
      jarvisContext: {
        sessionId: "sess-1",
        userId: "alice",
        recentIntents: [{ action: "check_weather", params: {}, confidence: 1, ambiguous: false }],
        currentTime: new Date(),
      },
    };
    await pool.execute(route, ctx);
    expect(client.chatCalls).toHaveLength(1);
    const system = client.chatCalls[0].system ?? "";
    expect(system).toContain("JARVIS");
    expect(system).toContain("User: alice");
    expect(system).toContain("Recent actions: check_weather");
  });

  it("general agent falls back to a default JarvisContext when none is provided", async () => {
    const client = new MockModelClient({
      response: { content: "AI response", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(client);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    // ctx has no jarvisContext — pool should synthesize a fallback.
    const ctxNoJc: AgentContext = {
      sessionId: "sess-2",
      intent: { action: "general", params: { text: "hi" }, confidence: 1, ambiguous: false },
    };
    await pool.execute(route, ctxNoJc);
    expect(client.chatCalls).toHaveLength(1);
    const system = client.chatCalls[0].system ?? "";
    expect(system).toContain("JARVIS");
    expect(system).toContain("User: desktop-user");
    expect(system).not.toContain("Recent actions:");
  });
});
