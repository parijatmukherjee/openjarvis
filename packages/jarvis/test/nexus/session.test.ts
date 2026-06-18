import { describe, it, expect, vi } from "vitest";
import { AgentSession } from "../../src/nexus/session.js";
import type { AgentSessionConfig, AgentResult, AgentRoute, AgentContext } from "../../src/nexus/types.js";
import type { AgentPool } from "../../src/nexus/pool.js";
import { InProcessAgentPool } from "../../src/nexus/pool.js";

function stubPool(overrides?: {
  executeResult?: AgentResult;
  delayMs?: number;
}): AgentPool {
  const executeResult = overrides?.executeResult ?? {
    agentId: "research",
    success: true,
    output: { results: ["sub-result"] },
    durationMs: 10,
  };
  const delayMs = overrides?.delayMs ?? 0;

  return {
    list: vi.fn(async () => []),
    execute: vi.fn(async (_route: AgentRoute, _context: AgentContext) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return executeResult;
    }),
    health: vi.fn(async () => true),
  };
}

function makeConfig(overrides?: Partial<AgentSessionConfig>): AgentSessionConfig {
  return {
    id: "session-test-1",
    parentAgentId: "parent-agent",
    mode: "fork",
    maxDepth: 2,
    timeoutMs: 5000,
    ...overrides,
  };
}

describe("AgentSession", () => {
  it("spawns sub-agent and returns result", async () => {
    const pool = stubPool();
    const session = new AgentSession(makeConfig(), pool);
    const result = await session.spawn("research", "search for AI papers");

    expect(result.success).toBe(true);
    expect(result.agentId).toBe("research");
    expect(pool.execute).toHaveBeenCalledOnce();
  });

  it("fork mode inherits parent context (same agent ID prefix)", async () => {
    const pool = stubPool();
    const config = makeConfig({ parentAgentId: "parent-agent", mode: "fork" });
    const session = new AgentSession(config, pool);
    await session.spawn("research", "search");

    const callArgs = (pool.execute as ReturnType<typeof vi.fn>).mock.calls[0][1] as AgentContext;
    expect(callArgs.sessionId).toBe("parent-agent-research");
  });

  it("isolated mode creates fresh context", async () => {
    const pool = stubPool();
    const config = makeConfig({ mode: "isolated" });
    const session = new AgentSession(config, pool);
    await session.spawn("research", "search");

    const callArgs = (pool.execute as ReturnType<typeof vi.fn>).mock.calls[0][1] as AgentContext;
    expect(callArgs.sessionId).toBe("research");
  });

  it("respects max depth (returns error when exceeded)", async () => {
    const pool = stubPool();
    const config = makeConfig({ maxDepth: 2 });
    const session = new AgentSession(config, pool);

    await session.spawn("research", "first");
    await session.spawn("research", "second");

    const result = await session.spawn("research", "third");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum depth/i);
  });

  it("respects timeout (returns error on timeout)", async () => {
    const pool = stubPool({ delayMs: 200 });
    const config = makeConfig({ timeoutMs: 50 });
    const session = new AgentSession(config, pool);

    const result = await session.spawn("research", "slow search");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout/i);
  });

  it("cancel() prevents execution", async () => {
    const pool = stubPool();
    const session = new AgentSession(makeConfig(), pool);
    session.cancel();

    const result = await session.spawn("research", "search");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cancelled/i);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("yield() stores message", async () => {
    const pool = stubPool();
    const session = new AgentSession(makeConfig(), pool);
    await session.yield("progress update");
    await session.yield("another update");

    expect(session.getYieldedMessages()).toEqual(["progress update", "another update"]);
  });

  it("session ID is unique per instantiation", () => {
    const realPool = new InProcessAgentPool();
    const session1 = realPool.createSession("agent-1", "fork");
    const session2 = realPool.createSession("agent-1", "fork");

    expect(session1.id).not.toBe(session2.id);
  });

  it("isCancelled returns false initially", () => {
    const pool = stubPool();
    const session = new AgentSession(makeConfig(), pool);
    expect(session.isCancelled).toBe(false);
  });

  it("currentDepth increments on each spawn", async () => {
    const pool = stubPool();
    const session = new AgentSession(makeConfig(), pool);
    expect(session.currentDepth).toBe(0);

    await session.spawn("research", "first");
    expect(session.currentDepth).toBe(1);

    await session.spawn("research", "second");
    expect(session.currentDepth).toBe(2);
  });
});