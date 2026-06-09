import { describe, it, expect } from "vitest";
import { PlaybookRun, type PlaybookRunDeps } from "../../src/playbook/runner.js";
import { DEFAULT_MANIFEST } from "../../src/playbook/manifest.js";
import { SoftGate, ValidateGate, type PhaseGate } from "../../src/playbook/gates.js";
import { isPhaseEvent } from "../../src/playbook/events.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { InMemoryAuditLog } from "../../src/security/audit.js";
import { fixedClock } from "../../src/util/clock.js";
import type { AgentGrant } from "../../src/security/capability.js";

const OPERATOR: AgentGrant = {
  agentId: "op",
  capabilities: [{ name: "playbook:override" }],
};

/** A gate that always returns the same verdict — stands in for SoftGate/ValidateGate.
 *  Used by the advance/override describe blocks appended in later tasks. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fakeGate(verdict: Awaited<ReturnType<PhaseGate["evaluate"]>>): PhaseGate {
  return { evaluate: async () => verdict };
}

function deps(overrides: Partial<PlaybookRunDeps> = {}): PlaybookRunDeps {
  return {
    manifest: DEFAULT_MANIFEST,
    sessionId: "s1",
    runId: "r1",
    store: new InMemoryEventStore(),
    audit: new InMemoryAuditLog(),
    grant: OPERATOR,
    softGate: new SoftGate(),
    validateGate: new ValidateGate(async () => ({ ok: true })),
    clock: fixedClock(1000),
    ...overrides,
  };
}

describe("PlaybookRun.start", () => {
  it("enters the manifest's first phase, recording one event and one audit entry", async () => {
    const d = deps();
    const run = await PlaybookRun.start(d);
    expect(run.state).toEqual({ phase: "Research", replans: 0 });
    expect(run.status()).toEqual({ kind: "running", phase: "Research" });

    const events = (await d.store.read("s1")).filter(isPhaseEvent);
    expect(events).toEqual([
      { type: "PhaseEntered", sessionId: "s1", runId: "r1", phase: "Research", at: 1000 },
    ]);

    const audit = await d.audit.entries();
    expect(audit.map((e) => e.kind)).toEqual(["PhaseEntered"]);
    expect(await d.audit.verify()).toBe(true);
  });

  it("throws if the manifest has no phases", async () => {
    await expect(
      PlaybookRun.start(deps({ manifest: { phases: [], maxReplans: 3 } })),
    ).rejects.toThrow(/no phases/);
  });
});
