import { describe, it, expect } from "vitest";
import {
  GroundingEngine,
  groundingInstruction,
  citedAnswerJsonSchema,
} from "../../src/grounding/grounding-engine.js";
import type { AcceptContext, ToolCallRecord } from "../../src/loop/turn.js";
import type { MetricsCollector } from "../../src/observability/metrics.js";

function okDiskFree(id = "oc-1", freeBytes = 12345): ToolCallRecord {
  return {
    call: { id, tool: "disk_free", args: { path: "/" } },
    result: { id, tool: "disk_free", ok: true, data: { path: "/", freeBytes } },
  };
}

const ungroundedFinal = (text: string): AcceptContext => ({ final: text, toolResults: [] });

describe("GroundingEngine — off mode (negative control)", () => {
  it("accepts any final, grounded or not", () => {
    const engine = new GroundingEngine({ mode: "off" });
    expect(engine.evaluate(ungroundedFinal("about 250 GB free")).accept).toBe(true);
  });
});

describe("GroundingEngine — preferred mode", () => {
  it("accepts an ungrounded answer but flags it", () => {
    const engine = new GroundingEngine({ mode: "preferred", qualifyingTools: ["disk_free"] });
    expect(engine.evaluate(ungroundedFinal("a guess"))).toEqual({
      accept: true,
      flagged: "ungrounded",
    });
  });

  it("accepts without a flag when a qualifying tool was called", () => {
    const engine = new GroundingEngine({ mode: "preferred", qualifyingTools: ["disk_free"] });
    expect(engine.evaluate({ final: "grounded", toolResults: [okDiskFree()] })).toEqual({
      accept: true,
    });
  });
});

describe("GroundingEngine — required mode", () => {
  const engine = new GroundingEngine({ mode: "required", qualifyingTools: ["disk_free"] });

  it("REJECTS a final produced before any successful tool call", () => {
    const decision = engine.evaluate(ungroundedFinal("about 250 GB free"));
    expect(decision.accept).toBe(false);
    expect(decision.correction).toMatch(/must successfully call disk_free/i);
  });

  it("accepts once a qualifying tool call has succeeded", () => {
    expect(engine.evaluate({ final: "12345 bytes", toolResults: [okDiskFree()] }).accept).toBe(
      true,
    );
  });

  it("accepts an honest unknown as success even without a tool call", () => {
    const decision = engine.evaluate(
      ungroundedFinal(JSON.stringify({ unknown: true, reason: "no daemon" })),
    );
    expect(decision).toEqual({ accept: true, flagged: "unknown" });
  });

  it("does not credit a FAILED tool call", () => {
    const failed: ToolCallRecord = {
      call: { id: "oc-1", tool: "disk_free", args: {} },
      result: { id: "oc-1", tool: "disk_free", ok: false, error: "capability denied" },
    };
    expect(engine.evaluate({ final: "guess", toolResults: [failed] }).accept).toBe(false);
  });
});

describe("GroundingEngine — cited mode (strongest)", () => {
  const engine = new GroundingEngine({ mode: "cited", qualifyingTools: ["disk_free"] });

  it("rejects before a tool call even if the JSON shape is valid", () => {
    const final = JSON.stringify({
      text: "x",
      claims: [{ statement: "x", citesToolResultId: "oc-1" }],
    });
    expect(engine.evaluate({ final, toolResults: [] }).accept).toBe(false);
  });

  it("rejects a non-JSON answer after a tool call (must be structured)", () => {
    const decision = engine.evaluate({ final: "12345 bytes free", toolResults: [okDiskFree()] });
    expect(decision.accept).toBe(false);
    expect(decision.correction).toMatch(/Respond ONLY as JSON/);
  });

  it("rejects when the cited numeric value does not match the tool result (fabrication)", () => {
    const final = JSON.stringify({
      text: "999 bytes free",
      claims: [
        { statement: "999 bytes free", citesToolResultId: "oc-1", value: 999, field: "freeBytes" },
      ],
    });
    const decision = engine.evaluate({ final, toolResults: [okDiskFree("oc-1", 12345)] });
    expect(decision.accept).toBe(false);
    expect(decision.correction).toMatch(/not supported by tool results/);
  });

  it("accepts a correctly cited answer and returns the cleaned text as the final", () => {
    const final = JSON.stringify({
      text: "12345 bytes are free.",
      claims: [
        {
          statement: "12345 bytes free",
          citesToolResultId: "oc-1",
          value: 12345,
          field: "freeBytes",
        },
      ],
    });
    const decision = engine.evaluate({ final, toolResults: [okDiskFree("oc-1", 12345)] });
    expect(decision).toEqual({ accept: true, final: "12345 bytes are free." });
  });
});

describe("GroundingEngine — metrics", () => {
  it("increments GroundingRejections when a final is rejected", () => {
    const counters: { name: string; value: number }[] = [];
    const metrics: MetricsCollector = {
      increment: (name, value = 1) => void counters.push({ name, value: value ?? 1 }),
      histogram() {},
    };
    const engine = new GroundingEngine(
      { mode: "required", qualifyingTools: ["disk_free"] },
      metrics,
    );
    const decision = engine.evaluate(ungroundedFinal("about 250 GB free"));
    expect(decision.accept).toBe(false);
    expect(counters.some((c) => c.name === "GroundingRejections" && c.value === 1)).toBe(true);
  });

  it("does NOT increment GroundingRejections when a final is accepted", () => {
    const counters: { name: string; value: number }[] = [];
    const metrics: MetricsCollector = {
      increment: (name, value = 1) => void counters.push({ name, value: value ?? 1 }),
      histogram() {},
    };
    const engine = new GroundingEngine(
      { mode: "required", qualifyingTools: ["disk_free"] },
      metrics,
    );
    const decision = engine.evaluate({ final: "12345 bytes", toolResults: [okDiskFree()] });
    expect(decision.accept).toBe(true);
    expect(counters.some((c) => c.name === "GroundingRejections")).toBe(false);
  });
});

describe("GroundingEngine helpers", () => {
  it("emits a JSON schema for cited answers (for native structured output)", () => {
    const schema = citedAnswerJsonSchema();
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).claims).toBeTruthy();
  });

  it("produces a mode-appropriate instruction; off mode is empty", () => {
    expect(groundingInstruction("off")).toBe("");
    expect(groundingInstruction("cited", ["disk_free"])).toMatch(/citesToolResultId/);
  });
});
