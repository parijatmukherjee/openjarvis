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
});
