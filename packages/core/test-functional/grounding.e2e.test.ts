import { describe, it, expect } from "vitest";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

// Black-box functional test: we spawn the REAL `ask` CLI exactly as a user runs it
// on their own machine — real OS, real `disk_free` tool, real grounding — and assert
// on its stdout. Only the "model" is the deterministic weak-model stand-in (the
// spec's replay mechanism), so the headline behavior is reproducible in CI on all
// three OSes. See test/eval/grounding.test.ts for the in-process version.

const run = promisify(execFile);
const ASK_CLI = "packages/core/dist/bin/ask.js";

interface Trace {
  prompt: string;
  model: string;
  grounding: string;
  accepted: boolean;
  corrections: number;
  modelCalls: number;
  toolCalls: { tool: string; ok: boolean; freeBytes?: number }[];
  final: string | null;
}

function lastJson(stdout: string): Trace {
  const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
  return JSON.parse(line) as Trace;
}

describe("ask CLI — grounding (black-box, exactly as a user runs it)", () => {
  it("cited mode: rejects the guess, calls the real tool, answers the real free-bytes", async () => {
    const { stdout } = await run("node", [
      ASK_CLI,
      "How much disk space is free on this machine?",
      "--json",
    ]);
    const trace = lastJson(stdout);

    expect(trace.grounding).toBe("cited");
    expect(trace.accepted).toBe(true);
    // The pre-tool fabrication was rejected (Eleven enforced grounding).
    expect(trace.corrections).toBeGreaterThanOrEqual(1);
    // The real tool ran on this real machine and succeeded.
    expect(trace.toolCalls).toHaveLength(1);
    expect(trace.toolCalls[0]).toMatchObject({ tool: "disk_free", ok: true });
    const free = trace.toolCalls[0].freeBytes!;
    expect(Number.isInteger(free)).toBe(true);
    expect(free).toBeGreaterThan(0);
    // The accepted answer states the tool's actual number — not the "250 GB" guess.
    expect(trace.final).toContain(String(free));
    expect(trace.final).not.toContain("250 GB");
  });

  it("negative control (--grounding off): the fabrication survives with no tool call", async () => {
    const { stdout } = await run("node", [
      ASK_CLI,
      "How much disk space is free on this machine?",
      "--grounding",
      "off",
      "--json",
    ]);
    const trace = lastJson(stdout);

    expect(trace.grounding).toBe("off");
    expect(trace.toolCalls).toHaveLength(0);
    expect(trace.corrections).toBe(0);
    expect(trace.accepted).toBe(true);
    expect(trace.final).toContain("250 GB"); // ungrounded => hallucination survives
  });

  it("plain (non-JSON) output prints just the grounded answer", async () => {
    const { stdout } = await run("node", [ASK_CLI, "How much disk is free?"]);
    expect(stdout).toMatch(/bytes are free on this machine\./);
  });
});

// Opt-in: run the slice against a user's REAL local Ollama. Skipped unless the
// machine actually has Ollama and the operator asks for it, so CI stays
// deterministic. This is the fullest "real user on their machine" check.
const ollamaLive = process.env.OPENHAWKINS_OLLAMA_E2E === "1";
const hasOllama = spawnSync("ollama", ["--version"], { encoding: "utf8" }).status === 0;

describe.skipIf(!(ollamaLive && hasOllama))("ask CLI — live Ollama (opt-in)", () => {
  it("a real local model is still forced to ground its answer in the real tool", async () => {
    const { stdout } = await run("node", [
      ASK_CLI,
      "How much disk space is free on this machine?",
      "--model",
      "ollama",
      "--grounding",
      "required",
      "--json",
    ]);
    const trace = lastJson(stdout);
    // Whatever the model does, the runtime must have either grounded via the tool
    // or accepted an honest unknown — it must NOT accept an ungrounded guess.
    const grounded = trace.toolCalls.some((t) => t.tool === "disk_free" && t.ok);
    expect(grounded || trace.final === null).toBe(true);
  }, 120000);
});
