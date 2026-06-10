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
  it("matches a value at an exact array index via dot-notation path", () => {
    const results: ToolCallRecord[] = [
      {
        call: { id: "t1", tool: "stats", args: {} },
        result: { id: "t1", tool: "stats", ok: true, data: { samples: [1, 2, 12345] } },
      },
    ];
    const answer: CitedAnswer = {
      text: "saw 12345",
      claims: [{ statement: "12345", citesToolResultId: "t1", value: 12345, field: "samples.2" }],
    };
    expect(verifyCitations(answer, results)).toEqual([]);
  });

  it("rejects when the path continues past a primitive (dot-path too deep)", () => {
    const results: ToolCallRecord[] = [
      {
        call: { id: "t1", tool: "stats", args: {} },
        result: { id: "t1", tool: "stats", ok: true, data: { size: 42 } },
      },
    ];
    const answer: CitedAnswer = {
      text: "42",
      claims: [{ statement: "42", citesToolResultId: "t1", value: 42, field: "size.nested" }],
    };
    const issues = verifyCitations(answer, results);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("value-mismatch");
  });

  it("rejects when a value exists elsewhere in the payload but not at the claimed array path", () => {
    const results: ToolCallRecord[] = [
      {
        call: { id: "t1", tool: "stats", args: {} },
        result: { id: "t1", tool: "stats", ok: true, data: { samples: [1, 2, 12345] } },
      },
    ];
    const answer: CitedAnswer = {
      text: "saw 12345",
      claims: [{ statement: "12345", citesToolResultId: "t1", value: 12345, field: "samples.0" }],
    };
    const issues = verifyCitations(answer, results);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("value-mismatch");
  });
});
