import { describe, it, expect } from "vitest";
import { SoftGate, type PhaseGate, type GateContext } from "../../src/playbook/gates.js";

describe("SoftGate", () => {
  it("always returns needs-operator, naming the phase", async () => {
    const gate: PhaseGate = new SoftGate();
    const ctx: GateContext = { phase: "Research" };
    const verdict = await gate.evaluate(ctx);
    expect(verdict.status).toBe("needs-operator");
    if (verdict.status === "needs-operator") {
      expect(verdict.reason).toContain("Research");
    }
  });
});
