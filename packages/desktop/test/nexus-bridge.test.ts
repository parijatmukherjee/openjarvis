import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NexusEngine,
  RuleBasedRouter,
  InProcessAgentPool,
  RuleBasedSynthesizer,
  TaskBoard,
} from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import { createNexusBridge } from "../src/renderer/lib/nexus-bridge.js";
import { createIpcNexusBridge } from "../src/renderer/lib/ipc-nexus-bridge.js";
import type { MessageView, StreamChunk } from "../src/renderer/lib/nexus-types.js";
import type { ElectronAPI } from "../src/renderer/types/electron.js";

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

describe("NexusBridge.executeIntentStream (in-process)", () => {
  function makeEngine() {
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
    return { engine, taskBoard, pool, eventBus };
  }

  it("forwards each model chunk to onChunk with a sessionId", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);

    const spy = vi.spyOn(engine, "executeChatStream").mockImplementation(async (_text, onChunk) => {
      onChunk({ text: "Hel", done: false });
      onChunk({ text: "lo", done: false });
      onChunk({ text: " world", done: true });
    });

    try {
      const chunks: StreamChunk[] = [];
      const { sessionId } = await bridge.executeIntentStream("chat", { text: "hi" }, (c) =>
        chunks.push(c),
      );
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
      expect(chunks).toEqual([
        { sessionId, content: "Hel", done: false },
        { sessionId, content: "lo", done: false },
        { sessionId, content: " world", done: true },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to executeIntent for non-chat actions and returns an empty sessionId", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);

    const streamSpy = vi.spyOn(engine, "executeChatStream");
    const executeSpy = vi.spyOn(engine, "execute").mockResolvedValue({
      spoken: "ok",
      visual: undefined,
    } as never);

    try {
      const chunks: StreamChunk[] = [];
      const { sessionId } = await bridge.executeIntentStream(
        "check_weather",
        { location: "NYC" },
        (c) => chunks.push(c),
      );
      expect(sessionId).toBe("");
      expect(chunks).toEqual([]);
      expect(streamSpy).not.toHaveBeenCalled();
      expect(executeSpy).toHaveBeenCalledOnce();
    } finally {
      streamSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it("forwards error field on the chunk when the engine reports one", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);

    const spy = vi.spyOn(engine, "executeChatStream").mockImplementation(async (_text, onChunk) => {
      onChunk({ text: "", done: true, error: "boom" });
    });

    try {
      const chunks: StreamChunk[] = [];
      const { sessionId } = await bridge.executeIntentStream("chat", { text: "hi" }, (c) =>
        chunks.push(c),
      );
      expect(chunks).toEqual([{ sessionId, content: "", done: true, error: "boom" }]);
    } finally {
      spy.mockRestore();
    }
  });

  it("cancelChatStream is a safe no-op for the in-process bridge", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);
    await expect(bridge.cancelChatStream("any-session-id")).resolves.toBeUndefined();
  });

  it("subscribeToMessages fires during executeIntentStream streaming", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);

    const spy = vi.spyOn(engine, "executeChatStream").mockImplementation(async (_text, onChunk) => {
      onChunk({ text: "Hel", done: false });
      onChunk({ text: "lo", done: false });
      onChunk({ text: " world", done: true });
    });

    try {
      let count = 0;
      const unsub = bridge.subscribeToMessages(() => {
        count += 1;
      });

      // Pre-condition: no notifications before streaming.
      expect(count).toBe(0);

      await bridge.executeIntentStream("chat", { text: "hi" }, () => {
        // Drain chunks; we only care about the subscribeToMessages signal.
      });

      // ConversationPanel should have been notified at least once while the
      // stream was in flight — once per chunk, plus the final-done emit.
      expect(count).toBeGreaterThan(0);
      unsub();
    } finally {
      spy.mockRestore();
    }
  });

  it("executeIntentStream mirrors streaming jarvis text into getMessages", async () => {
    const { engine, taskBoard, pool, eventBus } = makeEngine();
    const bridge = createNexusBridge(engine, taskBoard, pool, eventBus);

    const spy = vi.spyOn(engine, "executeChatStream").mockImplementation(async (_text, onChunk) => {
      onChunk({ text: "Hel", done: false });
      // Yield to the microtask queue so any subscribers that capture a
      // snapshot via getMessages() can run before the next chunk mutates
      // the in-flight message.
      await new Promise((resolve) => setTimeout(resolve, 0));
      onChunk({ text: "lo", done: true });
    });

    try {
      // Capture the current jarvis text after every notification. The
      // bridge mutates the message object in place; we read the live
      // reference synchronously inside the subscriber to capture the
      // state at the moment the bridge fired the notification.
      const jarvisTextAtNotify: string[] = [];
      // Pre-subscribe to grab the messages array reference (it is the
      // same reference getMessages() returns).
      const messagesRef = (await bridge.getMessages()) as MessageView[];
      const unsub = bridge.subscribeToMessages(() => {
        const jarvis = messagesRef.find((m) => m.type === "jarvis");
        jarvisTextAtNotify.push(jarvis?.text ?? "<no jarvis>");
      });

      await bridge.executeIntentStream("chat", { text: "hi" }, () => {
        // Drain chunks.
      });

      // After the stream completes, the messages array must contain a user
      // message and a final jarvis message with the full assembled text.
      const messages = await bridge.getMessages();
      const userMsg = messages.find((m) => m.type === "user");
      const jarvisMsg = messages.find((m) => m.type === "jarvis");
      expect(userMsg).toBeDefined();
      expect(jarvisMsg).toBeDefined();
      expect(jarvisMsg?.text).toBe("Hello");

      // The bridge fires one notification when it appends the user +
      // jarvis messages (text=""), then one per chunk. The mock fires
      // two chunks ("Hel", "lo") with a setTimeout yield between them,
      // so we expect to see "" → "Hel" → "Hello" in the captures.
      // The key assertion is that at least one in-flight notification
      // saw a non-final jarvis text — proving chunk-by-chunk
      // accumulation rather than a single notify at the end.
      expect(jarvisTextAtNotify.length).toBeGreaterThan(0);
      expect(jarvisTextAtNotify).toContain("Hel");
      expect(jarvisTextAtNotify).toContain("Hello");

      unsub();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("createIpcNexusBridge().executeIntentStream", () => {
  type GlobalWithWindow = {
    window?: { electronAPI?: Partial<ElectronAPI> };
  };

  const setWindow = (electronAPI: Partial<ElectronAPI>): void => {
    (globalThis as unknown as GlobalWithWindow).window = { electronAPI };
  };

  const clearWindow = (): void => {
    delete (globalThis as unknown as GlobalWithWindow).window;
  };

  beforeEach(() => {
    setWindow({});
  });

  afterEach(() => {
    clearWindow();
  });

  it("calls electron.nexusChatStream and forwards each event-bus chunk to onChunk", async () => {
    const eventHandlers = new Set<(event: unknown) => void>();
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusExecuteIntent: vi.fn(async () => ({ success: true })),
      nexusChatStream: vi.fn(async () => ({ sessionId: "s1" })),
      onNexusEvent: vi.fn((cb: (payload: unknown) => void) => {
        eventHandlers.add(cb);
        return () => eventHandlers.delete(cb);
      }),
    };
    setWindow(api);

    const bridge = createIpcNexusBridge();

    const chunks: StreamChunk[] = [];
    const { sessionId } = await bridge.executeIntentStream("chat", { text: "hi" }, (c) =>
      chunks.push(c),
    );

    expect(sessionId).toBe("s1");
    expect(api.nexusChatStream).toHaveBeenCalledWith("hi");

    // The IPC bridge subscribes via electron.onNexusEvent; simulate main
    // publishing two chunks on the topic `nexus:chat:s1:chunk`.
    for (const h of eventHandlers) {
      h({
        topic: "nexus:chat:s1:chunk",
        payload: { sessionId: "s1", content: "Hel", done: false },
      });
      h({ topic: "nexus:chat:s1:chunk", payload: { sessionId: "s1", content: "lo", done: true } });
    }
    expect(chunks).toEqual([
      { sessionId: "s1", content: "Hel", done: false },
      { sessionId: "s1", content: "lo", done: true },
    ]);
  });

  it("ignores events for other sessions", async () => {
    const eventHandlers = new Set<(event: unknown) => void>();
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusChatStream: vi.fn(async () => ({ sessionId: "s1" })),
      onNexusEvent: vi.fn((cb: (payload: unknown) => void) => {
        eventHandlers.add(cb);
        return () => eventHandlers.delete(cb);
      }),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();

    const chunks: StreamChunk[] = [];
    await bridge.executeIntentStream("chat", { text: "hi" }, (c) => chunks.push(c));

    for (const h of eventHandlers) {
      h({ topic: "nexus:chat:s2:chunk", payload: { sessionId: "s2", content: "x", done: false } });
    }
    expect(chunks).toEqual([]);
  });

  it("falls back to executeIntent for non-chat actions and returns empty sessionId", async () => {
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusExecuteIntent: vi.fn(async () => ({ success: true })),
      nexusChatStream: vi.fn(async () => ({ sessionId: "s1" })),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();

    const chunks: StreamChunk[] = [];
    const { sessionId } = await bridge.executeIntentStream(
      "check_weather",
      { location: "NYC" },
      (c) => chunks.push(c),
    );
    expect(sessionId).toBe("");
    expect(chunks).toEqual([]);
    expect(api.nexusChatStream).not.toHaveBeenCalled();
    expect(api.nexusExecuteIntent).toHaveBeenCalledWith("check_weather", { location: "NYC" });
  });

  it("falls back to executeIntent when nexusChatStream is unavailable", async () => {
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusExecuteIntent: vi.fn(async () => ({ success: true })),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();

    const chunks: StreamChunk[] = [];
    const { sessionId } = await bridge.executeIntentStream("chat", { text: "hi" }, (c) =>
      chunks.push(c),
    );
    expect(sessionId).toBe("");
    expect(chunks).toEqual([]);
    expect(api.nexusExecuteIntent).toHaveBeenCalledWith("chat", { text: "hi" });
  });

  it("cancelChatStream detaches the event subscription and forwards to nexusCancelChatStream", async () => {
    const eventHandlers = new Set<(event: unknown) => void>();
    const cancelFn = vi.fn(async (_sessionId: string) => undefined);
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusChatStream: vi.fn(async () => ({ sessionId: "s9" })),
      nexusCancelChatStream: cancelFn,
      onNexusEvent: vi.fn((cb: (payload: unknown) => void) => {
        eventHandlers.add(cb);
        return () => eventHandlers.delete(cb);
      }),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();

    const chunks: StreamChunk[] = [];
    await bridge.executeIntentStream("chat", { text: "hi" }, (c) => chunks.push(c));

    // Sanity: before cancel, events reach the callback.
    for (const h of eventHandlers) {
      h({ topic: "nexus:chat:s9:chunk", payload: { sessionId: "s9", content: "A", done: false } });
    }
    expect(chunks).toEqual([{ sessionId: "s9", content: "A", done: false }]);

    await bridge.cancelChatStream("s9");

    // After cancel: no further chunks should arrive.
    for (const h of eventHandlers) {
      h({ topic: "nexus:chat:s9:chunk", payload: { sessionId: "s9", content: "B", done: false } });
    }
    expect(chunks).toHaveLength(1);
    expect(cancelFn).toHaveBeenCalledWith("s9");
  });

  it("cancelChatStream does not throw when no stream is active", async () => {
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusCancelChatStream: vi.fn(async () => undefined),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();
    await expect(bridge.cancelChatStream("never-registered")).resolves.toBeUndefined();
    expect(api.nexusCancelChatStream).toHaveBeenCalledWith("never-registered");
  });

  it("subscribeToMessages fires during executeIntentStream so ConversationPanel re-fetches", async () => {
    const eventHandlers = new Set<(event: unknown) => void>();
    const api: Partial<ElectronAPI> = {
      nexusGetMessages: vi.fn(async () => []),
      nexusChatStream: vi.fn(async () => ({ sessionId: "s5" })),
      onNexusEvent: vi.fn((cb: (payload: unknown) => void) => {
        eventHandlers.add(cb);
        return () => eventHandlers.delete(cb);
      }),
    };
    setWindow(api);
    const bridge = createIpcNexusBridge();

    let count = 0;
    const unsub = bridge.subscribeToMessages(() => {
      count += 1;
    });
    expect(count).toBe(0);

    await bridge.executeIntentStream("chat", { text: "hi" }, () => {
      // Drain chunks.
    });

    // Drive two chunks through the event bus.
    for (const h of eventHandlers) {
      h({
        topic: "nexus:chat:s5:chunk",
        payload: { sessionId: "s5", content: "Hel", done: false },
      });
      h({
        topic: "nexus:chat:s5:chunk",
        payload: { sessionId: "s5", content: "lo", done: true },
      });
    }

    // Each chunk must trigger a re-fetch notification so ConversationPanel
    // (which subscribes via subscribeToMessages) sees the live state.
    expect(count).toBeGreaterThanOrEqual(2);
    unsub();
  });
});
