import type { GateVerdict } from "./machine.js";
import type { Phase } from "./manifest.js";

/** What a gate is given to decide a phase. Minimal in P1/P2; the P3 runner enriches it. */
export interface GateContext {
  phase: Phase;
}

/** A phase gate — the Eleven-style accept-or-correct policy for one phase. */
export interface PhaseGate {
  evaluate(ctx: GateContext): Promise<GateVerdict>;
}

/**
 * A soft phase has no machine-checkable completion (Research, Plan, …), so it always
 * pauses for a capability-gated operator decision (the override is handled by the P3
 * runner). The model can never self-certify a soft phase complete.
 */
export class SoftGate implements PhaseGate {
  async evaluate(ctx: GateContext): Promise<GateVerdict> {
    return {
      status: "needs-operator",
      reason: `phase "${ctx.phase}" needs an operator to confirm completion`,
    };
  }
}
