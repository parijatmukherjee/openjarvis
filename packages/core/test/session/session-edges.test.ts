import { describe, it, expect } from "vitest";
import { Session } from "../../src/session/session.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { fixedClock } from "../../src/util/clock.js";
import { rebuildState } from "../../src/session/replay.js";

describe("Session — non-Error throws and multi-turn fold", () => {
  it("stringifies a non-Error thrown value in TurnFailed", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-ne",
      agentId: "a",
      store,
      clock: fixedClock(0),
    });
    await session
      .runTurn("x", async () => {
        throw "stringy-failure";
      })
      .catch(() => undefined);

    const replayed = await rebuildState(store, "s-ne");
    expect(replayed.turns[0].error).toBe("stringy-failure");
  });

  it("preserves earlier turns when a later turn fails (fold else-branch)", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-mt",
      agentId: "a",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ok", async () => "done");
    await session
      .runTurn("bad", async () => {
        throw new Error("x");
      })
      .catch(() => undefined);

    const replayed = await rebuildState(store, "s-mt");
    expect(replayed.turns[0].final).toBe("done");
    expect(replayed.turns[0].error).toBeUndefined();
    expect(replayed.turns[1].error).toBe("x");
  });
});
