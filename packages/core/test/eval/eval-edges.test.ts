import { describe, it, expect } from "vitest";
import { finalMatchesToolNumber } from "../../src/eval/harness.js";
import { weakHostFactsModel } from "../../src/eval/scenarios.js";
import type { TurnRecord } from "../../src/loop/turn.js";

describe("finalMatchesToolNumber — missing final", () => {
  it("is false when the tool number exists but there is no final answer", () => {
    const rec: TurnRecord = {
      input: "q",
      modelCalls: [],
      corrections: [],
      accepted: false,
      toolCalls: [
        {
          call: { id: "1", tool: "disk_free", args: {} },
          result: { id: "1", tool: "disk_free", ok: true, data: { freeBytes: 5 } },
        },
      ],
    };
    expect(finalMatchesToolNumber("disk_free").check(rec)).toBe(false);
  });
});

describe("weakHostFactsModel — defensive fallback at step 3", () => {
  it("still emits a parseable answer when the tool message is absent", async () => {
    const model = weakHostFactsModel("/x");
    await model.generate({ messages: [] }); // step 1: fabricate
    await model.generate({ messages: [] }); // step 2: tool call
    const out = await model.generate({ messages: [] }); // step 3: no tool message present
    expect(out.content).toContain("undefined bytes are free");
  });
});
