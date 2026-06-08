import { describe, it, expect } from "vitest";
import { Session } from "../../src/session/session.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { fixedClock } from "../../src/util/clock.js";
import { rebuildState } from "../../src/session/replay.js";

describe("Session — failure handling", () => {
  it("records TurnFailed and rejects when the handler throws", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-fail",
      agentId: "a",
      store,
      clock: fixedClock(0),
    });

    await expect(
      session.runTurn("x", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const types = (await store.read("s-fail")).map((e) => e.type);
    expect(types).toEqual(["SessionStarted", "TurnStarted", "TurnFailed"]);
  });

  it("replays a failed turn into error state (TurnFailed fold)", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-replay-fail",
      agentId: "a",
      store,
      clock: fixedClock(0),
    });
    await session
      .runTurn("x", async () => {
        throw new Error("nope");
      })
      .catch(() => undefined);

    const replayed = await rebuildState(store, "s-replay-fail");
    expect(replayed.turns[0].error).toBe("nope");
    expect(replayed.turns[0].final).toBeUndefined();
  });

  it("defaults to the system clock when none is injected", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({ sessionId: "s-clk", agentId: "a", store });
    await session.runTurn("x", async () => "y");
    expect(session.state.turns[0].final).toBe("y");
  });
});
