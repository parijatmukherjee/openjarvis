import { describe, it, expect } from "vitest";
import { Session } from "../../src/session/session.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { fixedClock } from "../../src/util/clock.js";
import {
  rebuildState,
  assertDeterministic,
  rebuildStateStreaming,
} from "../../src/session/replay.js";
import type { DomainEvent, EventStore } from "../../src/session/events.js";

describe("replay", () => {
  it("rebuildState reconstructs the live session state from the event log", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-1",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ping", async () => "pong");

    const replayed = await rebuildState(store, "s-1");
    expect(replayed).toEqual(session.state);
  });

  it("assertDeterministic passes for a recorded log (same events -> same state)", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-1",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ping", async () => "pong");

    await expect(assertDeterministic(store, "s-1")).resolves.toBe(true);
  });

  it("rebuildStateStreaming produces identical state to rebuildState", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-1",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ping", async () => "pong");
    await session.runTurn("hello", async () => "world");

    const full = await rebuildState(store, "s-1");
    const streaming = await rebuildStateStreaming(store, "s-1", 2);
    expect(streaming).toEqual(full);
  });

  it("rebuildStateStreaming breaks when events have no seq field", async () => {
    const eventsWithoutSeq: DomainEvent[] = [
      { type: "SessionStarted", sessionId: "s-no-seq", agentId: "a", at: 0 },
      { type: "TurnStarted", sessionId: "s-no-seq", turnId: "t1", input: "hi", at: 1 },
      { type: "TurnEnded", sessionId: "s-no-seq", turnId: "t1", final: "bye", at: 2 },
    ];
    const noSeqStore: EventStore = {
      async append() {},
      async read() {
        return eventsWithoutSeq;
      },
    };

    const state = await rebuildStateStreaming(noSeqStore, "s-no-seq", 10);
    expect(state.turns).toHaveLength(1);
  });

  it("rebuildStateStreaming returns initialState for empty store", async () => {
    const emptyStore: EventStore = {
      async append() {},
      async read() {
        return [];
      },
    };

    const state = await rebuildStateStreaming(emptyStore, "s-empty", 10);
    expect(state.turns).toHaveLength(0);
  });
});
