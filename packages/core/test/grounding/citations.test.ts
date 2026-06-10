import { describe, it, expect } from "vitest";
import { verifyCitations, parseAnswer, type CitedAnswer } from "../../src/grounding/citations.js";
import type { ToolCallRecord } from "../../src/loop/turn.js";

function toolResult(id: string, ok: boolean, data: unknown): ToolCallRecord {
  return {
    call: { id, tool: "disk_free", args: {} },
    result: { id, tool: "disk_free", ok, ...(ok ? { data } : { error: "boom" }) },
  };
}

describe("parseAnswer", () => {
  it("classifies a well-formed cited answer", () => {
    const parsed = parseAnswer(
      JSON.stringify({
        text: "Free: 5 bytes",
        claims: [{ statement: "5", citesToolResultId: "t1", value: 5 }],
      }),
    );
    expect(parsed.kind).toBe("cited");
  });

  it("classifies an honest unknown", () => {
    expect(parseAnswer(JSON.stringify({ unknown: true, reason: "no tool" })).kind).toBe("unknown");
  });

  it("classifies non-JSON / wrong-shape as invalid", () => {
    expect(parseAnswer("about 250 GB free").kind).toBe("invalid");
    expect(parseAnswer(JSON.stringify({ text: "hi" })).kind).toBe("invalid"); // missing claims
  });

  it("rejects payloads exceeding MAX_ANSWER_BYTES", () => {
    const bigText = "x".repeat(1_048_576);
    const valid = JSON.stringify({
      text: bigText,
      claims: [{ statement: "ok", citesToolResultId: "t1" }],
    });
    expect(valid.length).toBeGreaterThan(1_048_576);
    const parsed = parseAnswer(valid);
    expect(parsed.kind).toBe("invalid");
  });
});

describe("verifyCitations", () => {
  const results = [toolResult("t1", true, { path: "/", freeBytes: 12345 })];

  it("passes when the cited id exists and the numeric value matches at the claimed field", () => {
    const answer: CitedAnswer = {
      text: "12345 bytes free",
      claims: [
        {
          statement: "12345 bytes free",
          citesToolResultId: "t1",
          value: 12345,
          field: "freeBytes",
        },
      ],
    };
    expect(verifyCitations(answer, results)).toEqual([]);
  });

  it("rejects a value that exists elsewhere in the payload but not at the claimed field (spoofing vector)", () => {
    const resultsSpoofed = [toolResult("t1", true, { usedBytes: 999, freeBytes: 123 })];
    const answer: CitedAnswer = {
      text: "999 bytes free",
      claims: [
        {
          statement: "999 bytes free",
          citesToolResultId: "t1",
          value: 999,
          field: "freeBytes", // the field claims 999, but freeBytes is 123
        },
      ],
    };
    const issues = verifyCitations(answer, resultsSpoofed);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("value-mismatch");
  });

  it("accepts a value when it matches exactly at a nested field path", () => {
    const resultsNested = [toolResult("t1", true, { nested: { size: 42 } })];
    const answer: CitedAnswer = {
      text: "42",
      claims: [
        {
          statement: "42",
          citesToolResultId: "t1",
          value: 42,
          field: "nested.size",
        },
      ],
    };
    expect(verifyCitations(answer, resultsNested)).toEqual([]);
  });

  it("flags a citation to a non-existent / failed tool result", () => {
    const answer: CitedAnswer = {
      text: "x",
      claims: [{ statement: "x", citesToolResultId: "does-not-exist" }],
    };
    const issues = verifyCitations(answer, results);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("unknown-citation");
  });

  it("flags a numeric value that the cited result does not contain at the field (the fabrication catch)", () => {
    const answer: CitedAnswer = {
      text: "999 bytes free",
      claims: [
        { statement: "999 bytes free", citesToolResultId: "t1", value: 999, field: "freeBytes" },
      ],
    };
    const issues = verifyCitations(answer, results);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("value-mismatch");
  });

  it("does not credit a citation to a failed tool result", () => {
    const failed = [toolResult("t1", false, undefined)];
    const answer: CitedAnswer = {
      text: "x",
      claims: [{ statement: "x", citesToolResultId: "t1" }],
    };
    expect(verifyCitations(answer, failed)[0].reason).toBe("unknown-citation");
  });
});
