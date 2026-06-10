import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Black-box: spawn the actual built durable CLI, then RE-SPAWN a separate process to
// verify — proving events + the keyed audit chain survive across processes on disk.
const run = promisify(execFile);
const CLI = "packages/state/dist/bin/openjarvis-run.js";

describe("openjarvis-run — durable functional (black-box, cross-process)", () => {
  it("persists a keyed-audit run and a fresh process verifies it", async () => {
    const d = mkdtempSync(join(tmpdir(), "oh-a1b-fn-"));
    const db = join(d, "run.db");
    const vault = join(d, "vault.json");
    const common = ["--db", db, "--vault", vault, "--json"];

    const r1 = await run("node", [CLI, ...common]);
    const out1 = JSON.parse(r1.stdout.trim().split("\n").filter(Boolean).pop() ?? "");
    expect(out1.mode).toBe("run");
    expect(out1.result.kind).toBe("completed");
    expect(out1.auditVerified).toBe(true);

    const r2 = await run("node", [CLI, ...common, "--verify"]);
    const out2 = JSON.parse(r2.stdout.trim().split("\n").filter(Boolean).pop() ?? "");
    expect(out2.mode).toBe("verify");
    expect(out2.auditVerified).toBe(true);
    expect(out2.events).toBeGreaterThan(0);
    expect(out2.auditEntries).toBeGreaterThan(6);
  });
});
