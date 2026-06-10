import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHealth } from "../src/health.js";

describe("checkHealth", () => {
  it("reports healthy on a clean empty db+vault", async () => {
    const d = mkdtempSync(join(tmpdir(), "oh-health-"));
    const result = await checkHealth({
      dbPath: join(d, "health.db"),
      vaultPath: join(d, "vault.json"),
      passphrase: "test",
    });
    expect(result.dbOk).toBe(true);
    expect(result.vaultUnlocked).toBe(true);
    expect(result.lastAuditVerified).toBe(true);
    expect(result.recentErrorRate).toBe(0);
  });
});
