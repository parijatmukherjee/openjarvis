import { describe, it, expect } from "vitest";
import { GroundingEngine, groundingInstruction } from "../../src/grounding/grounding-engine.js";
import { parseAnswer } from "../../src/grounding/citations.js";
import type { ToolCallRecord } from "../../src/loop/turn.js";

const okDiskFree: ToolCallRecord = {
  call: { id: "oc-1", tool: "disk_free", args: { path: "/" } },
  result: { id: "oc-1", tool: "disk_free", ok: true, data: { path: "/", freeBytes: 12345 } },
};

describe("GroundingEngine — cited mode edge cases", () => {
  const engine = new GroundingEngine({ mode: "cited", qualifyingTools: ["disk_free"] });

  it("rejects a structurally valid answer with zero claims", () => {
    const final = JSON.stringify({ text: "I am sure", claims: [] });
    const decision = engine.evaluate({ final, toolResults: [okDiskFree] });
    expect(decision.accept).toBe(false);
    expect(decision.correction).toMatch(/cite at least one tool result/);
  });
});

describe("groundingInstruction covers every mode", () => {
  it("preferred nudges; required mandates; cited demands JSON citations; off is empty", () => {
    expect(groundingInstruction("preferred", ["disk_free"])).toMatch(/Prefer calling/);
    expect(groundingInstruction("required", ["disk_free"])).toMatch(/MUST call/);
    expect(groundingInstruction("cited", ["disk_free"])).toMatch(/citesToolResultId/);
    expect(groundingInstruction("off")).toBe("");
  });

  it("falls back to a generic tool name when none are given", () => {
    expect(groundingInstruction("required")).toMatch(/the available tools/);
  });
});

describe("parseAnswer invalid input", () => {
  it("treats malformed JSON as invalid", () => {
    expect(parseAnswer("{ not valid json").kind).toBe("invalid");
  });
});
