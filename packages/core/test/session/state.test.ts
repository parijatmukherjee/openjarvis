import { describe, it, expect } from "vitest";
import { initialState, reduceEvent, foldEvents } from "../../src/session/state.js";
import type { DomainEvent } from "../../src/session/events.js";

const events: DomainEvent[] = [
  { type: "SessionStarted", sessionId: "s-1", agentId: "probe-agent", at: 1 },
  { type: "TurnStarted", sessionId: "s-1", turnId: "t-1", input: "hi", at: 2 },
  { type: "TurnEnded", sessionId: "s-1", turnId: "t-1", final: "hello", at: 3 },
];

describe("session state fold", () => {
  it("reduceEvent is pure (does not mutate its input)", () => {
    const s0 = initialState();
    const s1 = reduceEvent(s0, events[0]);
    expect(s0.agentId).toBeUndefined();
    expect(s1.agentId).toBe("probe-agent");
  });

  it("foldEvents rebuilds the full session state", () => {
    const s = foldEvents(events);
    expect(s.agentId).toBe("probe-agent");
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0]).toEqual({ id: "t-1", input: "hi", final: "hello" });
  });

  it("is deterministic — same events produce equal state", () => {
    expect(foldEvents(events)).toEqual(foldEvents(events));
  });

  it("TurnFailed marks the turn with an error and leaves final unset", () => {
    const s = foldEvents([
      { type: "SessionStarted", sessionId: "s-1", agentId: "a", at: 1 },
      { type: "TurnStarted", sessionId: "s-1", turnId: "t-1", input: "hi", at: 2 },
      { type: "TurnFailed", sessionId: "s-1", turnId: "t-1", error: "boom", at: 3 },
    ]);
    expect(s.turns[0]).toEqual({ id: "t-1", input: "hi", error: "boom" });
  });
});
