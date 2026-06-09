import { describe, it, expect } from "vitest";
import { ScriptedOperator, HumanOperator } from "../../src/playbook/operators.js";

describe("ScriptedOperator", () => {
  it("returns its decisions in order, then declines once exhausted", async () => {
    const op = new ScriptedOperator([
      { approve: true, actor: "alice", reason: "spikes done" },
      { approve: false },
    ]);
    expect(await op.review({ phase: "Research", reason: "x" })).toEqual({
      approve: true,
      actor: "alice",
      reason: "spikes done",
    });
    expect(await op.review({ phase: "Plan", reason: "x" })).toEqual({ approve: false });
    // exhausted -> declines (a safe default rather than throwing)
    expect(await op.review({ phase: "Tasks", reason: "x" })).toEqual({ approve: false });
  });
});

describe("HumanOperator", () => {
  it("approves on a 'y' line and declines otherwise, prompting with the phase + reason", async () => {
    const lines = ["y\n", "n\n"];
    const out: string[] = [];
    const op = new HumanOperator({
      actor: "carol",
      readLine: async () => lines.shift() ?? "n\n",
      write: (s) => void out.push(s),
    });
    const yes = await op.review({ phase: "Research", reason: "confirm spikes" });
    expect(yes).toEqual({ approve: true, actor: "carol", reason: "operator approved Research" });
    expect(out.join("")).toContain("Research");
    expect(out.join("")).toContain("confirm spikes");
    const no = await op.review({ phase: "Plan", reason: "confirm plan" });
    expect(no).toEqual({ approve: false });
  });
});
