import { describe, it, expect } from "vitest";
import {
  NexusEngine,
  RuleBasedRouter,
  InProcessAgentPool,
  RuleBasedSynthesizer,
  TaskBoard,
} from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import { createNexusBridge } from "../src/renderer/lib/nexus-bridge.js";

describe("NexusBridge", () => {
  function makeBridge() {
    const eventBus = new SimpleEventBus();
    const router = new RuleBasedRouter();
    const pool = new InProcessAgentPool();
    const synthesizer = new RuleBasedSynthesizer();
    const taskBoard = new TaskBoard(eventBus);
    const engine = new NexusEngine({
      intentRouter: router,
      agentPool: pool,
      synthesizer,
      eventBus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 30000,
    });
    return createNexusBridge(engine, taskBoard, pool, eventBus);
  }

  it("getAgents returns agents from the pool with required fields", async () => {
    const bridge = makeBridge();
    const agents = await bridge.getAgents();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0].id).toBe("research");
    expect(agents[0]).toHaveProperty("status");
    expect(agents[0]).toHaveProperty("capabilities");
    expect(agents[0]).toHaveProperty("lastActivity");
    expect(agents[0]).toHaveProperty("tasksCompleted");
    expect(agents[0]).toHaveProperty("name");
    expect(agents[0]).toHaveProperty("role");
    expect(agents[0]).toHaveProperty("description");
  });

  it("getAgents returns real pool data, not hardcoded fake data", async () => {
    const bridge = makeBridge();
    const agents = await bridge.getAgents();
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("research");
    expect(ids).toContain("weather");
    expect(ids).toContain("calendar");
    expect(ids).toContain("general");
    expect(ids).toContain("vision");
  });

  it("getAgents lastActivity is not fake timestamp", async () => {
    const bridge = makeBridge();
    const agents = await bridge.getAgents();
    for (const agent of agents) {
      expect(agent.lastActivity).not.toBe("2m ago");
      expect(agent.lastActivity).not.toBe("5m ago");
      expect(agent.lastActivity).not.toBe("1h ago");
      expect(agent.lastActivity).not.toBe("now");
    }
  });

  it("getAgents tasksCompleted is zero for fresh pool", async () => {
    const bridge = makeBridge();
    const agents = await bridge.getAgents();
    for (const agent of agents) {
      expect(agent.tasksCompleted).toBe(0);
    }
  });

  it("getTasks returns empty initially", async () => {
    const bridge = makeBridge();
    const tasks = await bridge.getTasks();
    expect(tasks).toEqual([]);
  });

  it("getMessages returns empty initially", async () => {
    const bridge = makeBridge();
    const messages = await bridge.getMessages();
    expect(messages).toEqual([]);
  });

  it("executeIntent adds a user message", async () => {
    const bridge = makeBridge();
    await bridge.executeIntent("check_weather", { location: "NYC" });
    const messages = await bridge.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("user");
    expect(messages[0].text).toContain("check_weather");
  });

  it("executeIntent uses unique session IDs", async () => {
    const bridge = makeBridge();
    await bridge.executeIntent("search", { query: "test" });
    await bridge.executeIntent("search", { query: "test2" });
    const messages = await bridge.getMessages();
    expect(messages).toHaveLength(2);
  });

  it("subscribeToEvents returns an unsubscribe function", () => {
    const bridge = makeBridge();
    const unsub = bridge.subscribeToEvents(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("subscribeToMessages returns an unsubscribe function", () => {
    const bridge = makeBridge();
    const unsub = bridge.subscribeToMessages(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("subscribeToMessages fires synchronously on executeIntent", async () => {
    const bridge = makeBridge();
    const calls: number[] = [];
    const unsub = bridge.subscribeToMessages(() => {
      calls.push(calls.length + 1);
    });

    await bridge.executeIntent("check_weather", { location: "NYC" });
    expect(calls.length).toBeGreaterThan(0);
    unsub();
  });

  it("subscribeToMessages stops firing after unsubscribe", async () => {
    const bridge = makeBridge();
    let count = 0;
    const unsub = bridge.subscribeToMessages(() => {
      count += 1;
    });
    await bridge.executeIntent("search", { query: "first" });
    const afterFirst = count;
    unsub();
    await bridge.executeIntent("search", { query: "second" });
    expect(count).toBe(afterFirst);
  });

  it("subscribeToEvents receives nexus events", async () => {
    const bridge = makeBridge();
    const events: unknown[] = [];
    const unsub = bridge.subscribeToEvents((event) => {
      events.push(event);
    });

    await bridge.executeIntent("search", { query: "test" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    unsub();
    expect(events.length).toBeGreaterThan(0);
  });

  it("getAgents status is derived from pool.active field", async () => {
    const bridge = makeBridge();
    const agents = await bridge.getAgents();
    const activeAgents = agents.filter((a) => a.status === "active");
    expect(activeAgents.length).toBeGreaterThan(0);
  });
});
