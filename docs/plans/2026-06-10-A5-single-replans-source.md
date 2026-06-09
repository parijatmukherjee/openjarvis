# A5 — Fix the dual `replans` (F-H2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the event-fold (`reducePlaybook`) the single source of truth for a run's
`replans` count, removing the parallel count that `machine.step()` computes and the runner
then discards (review finding **F-H2**).

**Architecture:** Today `step()` returns a full `next: PlaybookRunState` whose `replans` is
`state.replans + 1`, but `PlaybookRun.advance()` ignores that number and re-derives state by
folding the committed `PhaseGateFailed` event through `reducePlaybook` (which independently
does `+1`). Two formulas, kept equal only by luck — a latent drift that would break the
"fold the log = state" invariant. Fix: `Transition` carries only the target `phase` and an
`outcome`; `step()` makes its escalate-vs-replan decision by reading the canonical
`state.replans` (`state.replans >= maxReplans`, algebraically identical to the old
`state.replans + 1 > maxReplans`); the increment lives in exactly one place — the
`reducePlaybook` fold. The runner's observable behavior is unchanged.

**Tech Stack:** TypeScript (strict ESM, `.js` specifiers), Vitest.

---

## File Structure

- `packages/core/src/playbook/machine.ts` — `Transition` type + `step()` body (reshape).
- `packages/core/src/playbook/runner.ts` — three `transition.next.phase` → `transition.phase`
  call sites; refresh one stale comment.
- `packages/core/test/playbook/machine.test.ts` — assertions move to the new `Transition`
  shape (these drive the change RED→GREEN).
- `packages/core/test/playbook/runner.test.ts` — one stale formula comment; add the F-H2
  invariant regression test.

---

### Task 1: Reshape `Transition` and `step` so `step` no longer counts replans

The `Transition` shape change breaks `runner.ts`'s compile, so `machine.ts`, `runner.ts`,
and `machine.test.ts` move together in one commit to keep the build green.

**Files:**
- Modify: `packages/core/src/playbook/machine.ts`
- Modify: `packages/core/src/playbook/runner.ts:95-101,143-145`
- Test: `packages/core/test/playbook/machine.test.ts`

- [ ] **Step 1: Rewrite the `machine.test.ts` assertions to the new `Transition` shape (RED)**

Replace the body of `packages/core/test/playbook/machine.test.ts` (keep the imports and the
`passed`/`failed`/`needsOp`/`at` helpers at the top) so every expectation drops the
`next: {phase, replans}` wrapper for a flat `{ phase, outcome }`:

```ts
describe("playbook machine — step", () => {
  it("a passed gate advances to the sequential next phase", () => {
    expect(step(DEFAULT_MANIFEST, at("Research"), passed)).toEqual({
      phase: "Plan",
      outcome: "advanced",
    });
    expect(step(DEFAULT_MANIFEST, at("Execute"), passed)).toEqual({
      phase: "Validate",
      outcome: "advanced",
    });
  });

  it("a passed Validate advances to the terminal Present phase", () => {
    expect(step(DEFAULT_MANIFEST, at("Validate"), passed)).toEqual({
      phase: "Present",
      outcome: "advanced",
    });
  });

  it("a failed Validate routes to onFail (Plan); the fold owns the count", () => {
    expect(step(DEFAULT_MANIFEST, at("Validate", 0), failed)).toEqual({
      phase: "Plan",
      outcome: "replan",
    });
  });

  it("the last replan within budget still routes to onFail (not escalation)", () => {
    // maxReplans is 3; at replans 2 the budget is not yet spent (2 >= 3 is false), so this
    // is still a replan. Brackets the budget boundary from below so a `>=`->`>` regression
    // (which would escalate one failure too late) is caught.
    expect(step(DEFAULT_MANIFEST, at("Validate", 2), failed)).toEqual({
      phase: "Plan",
      outcome: "replan",
    });
  });

  it("exceeding maxReplans escalates instead of looping", () => {
    // maxReplans is 3; at replans 3 the budget is spent (3 >= 3), so the next failure
    // escalates and stays on Validate.
    expect(step(DEFAULT_MANIFEST, at("Validate", 3), failed)).toEqual({
      phase: "Validate",
      outcome: "escalated",
    });
  });

  it("a needs-operator verdict pauses without moving", () => {
    expect(step(DEFAULT_MANIFEST, at("Research"), needsOp)).toEqual({
      phase: "Research",
      outcome: "paused",
    });
  });

  it("any verdict at the terminal phase is a no-op", () => {
    expect(step(DEFAULT_MANIFEST, at("Present"), passed)).toEqual({
      phase: "Present",
      outcome: "noop",
    });
  });

  it("a failed gate with no onFail stays on the same phase", () => {
    const m: PlaybookManifest = {
      phases: [
        { phase: "Validate", gate: "validate" },
        { phase: "Present", gate: "soft" },
      ],
      maxReplans: 3,
    };
    expect(step(m, at("Validate", 0), failed)).toEqual({
      phase: "Validate",
      outcome: "replan",
    });
  });
});
```

- [ ] **Step 2: Run the machine tests to verify they fail**

Run: `npm run -w @openhawkins/core test -- machine.test.ts`
Expected: FAIL — the old `step` returns `{ next: {...}, outcome }`, not `{ phase, outcome }`.

- [ ] **Step 3: Reshape `Transition` and `step` in `machine.ts`**

Replace the `Transition` interface and `step` function in
`packages/core/src/playbook/machine.ts`. Add `Phase` to the existing manifest import; the
`PlaybookRunState` import stays (it is still the `state` parameter type):

```ts
import { type PlaybookManifest, type Phase, phaseSpec, nextPhase } from "./manifest.js";
import type { PlaybookRunState } from "./events.js";
```

```ts
/** What `step` decided: the phase to enter next and an outcome label. Deliberately does NOT
 *  carry a `replans` count — that lives in exactly one place, the `reducePlaybook` fold over
 *  `PhaseGateFailed` events, so the runtime count and the replayed count cannot drift
 *  (review F-H2). The runner performs the event commits, audit, and capability checks. */
export interface Transition {
  phase: Phase;
  outcome: "advanced" | "replan" | "escalated" | "paused" | "noop";
}

/**
 * The pure transition function. Given the current run state and a gate verdict, compute the
 * phase to enter next and an outcome label. No IO, and no counting: the escalate-vs-replan
 * decision reads the canonical, event-folded `state.replans` rather than maintaining its own.
 */
export function step(
  manifest: PlaybookManifest,
  state: PlaybookRunState,
  verdict: GateVerdict,
): Transition {
  const successor = nextPhase(manifest, state.phase);
  if (successor === undefined) {
    return { phase: state.phase, outcome: "noop" }; // terminal phase: nothing advances
  }
  switch (verdict.status) {
    case "passed":
      return { phase: successor, outcome: "advanced" };
    case "failed": {
      // Escalate once the replan budget is spent. `state.replans` is the canonical count
      // folded from the log; `>= maxReplans` is exactly the old `state.replans + 1 >
      // maxReplans` — the +1 now happens only in `reducePlaybook` when the runner commits
      // the `PhaseGateFailed` event this failure produces.
      if (state.replans >= manifest.maxReplans) {
        return { phase: state.phase, outcome: "escalated" };
      }
      const target = phaseSpec(manifest, state.phase).onFail ?? state.phase;
      return { phase: target, outcome: "replan" };
    }
    case "needs-operator":
      return { phase: state.phase, outcome: "paused" };
  }
}
```

- [ ] **Step 4: Update the three `transition.next.phase` call sites in `runner.ts`**

In `packages/core/src/playbook/runner.ts`, the `advanced` and `replan` cases of `advance()`
(lines ~95-101) and the `override()` path (lines ~143-145) reference `transition.next.phase`.
Change each to `transition.phase`:

```ts
      case "advanced":
        await this.commit(this.gatePassed(phase));
        await this.enter(transition.phase);
        this._status = this.statusForPhase(transition.phase);
        break;
      case "replan":
        await this.commit(this.gateFailed(phase, reason, false));
        await this.enter(transition.phase);
        this._status = { kind: "running", phase: transition.phase };
        break;
```

```ts
    const transition = step(this.deps.manifest, this._state, { status: "passed" });
    await this.enter(transition.phase);
    this._status = this.statusForPhase(transition.phase);
```

- [ ] **Step 5: Run the machine + runner tests to verify they pass**

Run: `npm run -w @openhawkins/core test -- machine.test.ts runner.test.ts`
Expected: PASS. The runner's observable behavior (phases, replans, escalation thresholds) is
unchanged — only `step`'s internal shape moved.

- [ ] **Step 6: Typecheck the package + test project**

Run: `npm run build`
Expected: clean (no `transition.next` references remain).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/playbook/machine.ts packages/core/src/playbook/runner.ts \
  packages/core/test/playbook/machine.test.ts
git commit -m "refactor(playbook): single source of truth for replans (F-H2)"
```

---

### Task 2: F-H2 invariant regression test + stale-comment fix + gate

**Files:**
- Modify: `packages/core/test/playbook/runner.test.ts:122` (stale `0+1 > 0` comment)
- Test: `packages/core/test/playbook/runner.test.ts` (new invariant test)

- [ ] **Step 1: Add the F-H2 invariant test (RED-safe regression guard)**

Append this test to `packages/core/test/playbook/runner.test.ts`, inside the top-level
`describe`. It drives a run through a real replan and asserts the folded log equals the live
state — the property F-H2 protects. `foldPlaybook` and `isPhaseEvent` come from
`../../src/playbook/events.js`; reuse the file's existing `deps`/`fakeGate`/`PlaybookRun`
imports and its `InMemoryEventStore` cast pattern. Add the `foldPlaybook, isPhaseEvent`
import to the existing events import line if not already present.

```ts
  it("the folded event log is the single source of truth for replans (F-H2)", async () => {
    const d = deps({ validateGate: fakeGate({ status: "failed", reason: "red" }) });
    const run = await PlaybookRun.start(d);
    await run.override("op", "to plan"); // Research -> Plan
    await run.override("op", "to tasks"); // Plan -> Tasks
    await run.override("op", "to execute"); // Tasks -> Execute
    await run.override("op", "to validate"); // Execute -> Validate
    await run.advance(); // Validate fails -> replan (replans 0 -> 1)

    const log = (await (d.store as InMemoryEventStore).read("s1")).filter(isPhaseEvent);
    // The live runtime count and the count re-derived purely from the event log agree —
    // there is no second place that could drift.
    expect(foldPlaybook(log).replans).toBe(run.state.replans);
    expect(run.state.replans).toBe(1);
  });
```

If the `read` session id in this file is not `"s1"`, match whatever `deps()` uses (grep the
file's other `.read(...)` calls).

- [ ] **Step 2: Fix the stale formula comment on the escalation test**

In the existing "escalates when the replan budget is exhausted" test, the inline comment
reads `// fails; replans (0+1) > maxReplans (0) -> escalate`. Update it to the new formula:

```ts
    const status = await run.advance(); // fails; replans (0) >= maxReplans (0) -> escalate
```

- [ ] **Step 3: Run the runner tests**

Run: `npm run -w @openhawkins/core test -- runner.test.ts`
Expected: PASS (the invariant holds; the comment change is inert).

- [ ] **Step 4: Mark A5 done in the review roadmap**

In `docs/reviews/2026-06-09-production-readiness-review.md`, change the A5 roadmap line to:

```md
5. **A5 — Fix the dual `replans` (F-H2) ✅ DONE (PR pending).** `reducePlaybook` (the fold over `PhaseGateFailed`) is now the sole place `replans` increments; `machine.step()` no longer carries a parallel count — its `Transition` returns only the target phase + outcome, and the escalate decision reads the canonical `state.replans` (`>= maxReplans`). A runner invariant test asserts `foldPlaybook(log).replans === run.state.replans`, so the "fold the log = state" property is regression-guarded.
```

- [ ] **Step 5: Full repo gate**

Run:
```bash
npm run build && npm run lint && npm run format:check && npm run coverage && npm run test:functional
```
Expected: all green, coverage 100%.

- [ ] **Step 6: Docker gate**

Run: `docker build -f Dockerfile.test -t openhawkins-test . && docker run --rm openhawkins-test`
Expected: `✅ ALL GATES PASSED`

- [ ] **Step 7: Commit**

```bash
git add packages/core/test/playbook/runner.test.ts \
  docs/reviews/2026-06-09-production-readiness-review.md
git commit -m "test(playbook): F-H2 fold==state invariant; mark A5 done"
```
