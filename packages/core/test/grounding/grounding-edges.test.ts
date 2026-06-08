import { describe, it, expect } from "vitest";
import { Eleven } from "../../src/grounding/eleven.js";
import { verifyCitations, type CitedAnswer } from "../../src/grounding/citations.js";
import type { ToolCallRecord } from "../../src/loop/turn.js";

describe("Eleven cited — unknown path", () => {
  it("accepts an honest unknown even in cited mode (before any tool call)", () => {
    const eleven = new Eleven({ mode: "cited", qualifyingTools: ["disk_free"] });
    const decision = eleven.evaluate({ final: JSON.stringify({ unknown: true }), toolResults: [] });
    expect(decision).toEqual({ accept: true, flagged: "unknown" });
  });
});

describe("verifyCitations — value nested inside an array", () => {
  it("finds a numeric value inside an array in the tool-result payload", () => {
    const results: ToolCallRecord[] = [
      {
        call: { id: "t1", tool: "stats", args: {} },
        result: { id: "t1", tool: "stats", ok: true, data: { samples: [1, 2, 12345] } },
      },
    ];
    const answer: CitedAnswer = {
      text: "saw 12345",
      claims: [{ statement: "12345", citesToolResultId: "t1", value: 12345 }],
    };
    expect(verifyCitations(answer, results)).toEqual([]);
  });
});
