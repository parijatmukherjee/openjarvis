import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "../../src/security/audit.js";

describe("InMemoryAuditLog (Murray)", () => {
  it("chains entries and verifies a clean log", async () => {
    const log = new InMemoryAuditLog();
    await log.append({ kind: "ToolCalled", data: { tool: "disk_free" }, at: 1 });
    await log.append({ kind: "FinalAccepted", data: { final: "12345 bytes" }, at: 2 });

    const entries = await log.entries();
    expect(entries.map((e) => e.seq)).toEqual([0, 1]);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(await log.verify()).toBe(true);
  });

  it("verify() FAILS after a past entry is tampered with", async () => {
    const log = new InMemoryAuditLog();
    await log.append({ kind: "GroundingEvaluated", data: { accept: false }, at: 1 });
    await log.append({ kind: "FinalAccepted", data: { final: "real" }, at: 2 });

    // Tamper: rewrite history. entries() returns references to the stored entries.
    const entries = await log.entries();
    (entries[0].data as { accept: boolean }).accept = true;

    expect(await log.verify()).toBe(false);
  });

  it("redacts secrets before they enter the chained record", async () => {
    const log = new InMemoryAuditLog();
    const entry = await log.append({
      kind: "ModelRequested",
      data: { model: "gpt-oss:120b", apiKey: "sk-cloud-should-not-persist" },
      at: 1,
    });
    expect(entry.data.apiKey).toBe("[REDACTED]");
    expect(JSON.stringify(await log.entries())).not.toContain("sk-cloud-should-not-persist");
    expect(await log.verify()).toBe(true);
  });
});
