import { describe, it, expect } from "vitest";
import { finalMatchesToolNumber, finalContains } from "../../src/eval/harness.js";
import type { TurnRecord } from "../../src/loop/turn.js";

const baseRecord = (over: Partial<TurnRecord>): TurnRecord => ({
  input: "q",
  modelCalls: [],
  toolCalls: [],
  corrections: [],
  accepted: true,
  ...over,
});

describe("finalMatchesToolNumber", () => {
  it("is false when no qualifying tool call exists", () => {
    const rec = baseRecord({ final: "12345 bytes" });
    expect(finalMatchesToolNumber("disk_free").check(rec)).toBe(false);
  });

  it("is false when the tool result carries no freeBytes", () => {
    const rec = baseRecord({
      final: "x",
      toolCalls: [
        {
          call: { id: "1", tool: "disk_free", args: {} },
          result: { id: "1", tool: "disk_free", ok: true, data: {} },
        },
      ],
    });
    expect(finalMatchesToolNumber("disk_free").check(rec)).toBe(false);
  });
});

describe("finalContains", () => {
  it("treats a missing final as not containing the text", () => {
    expect(finalContains("anything").check(baseRecord({}))).toBe(false);
  });
});
