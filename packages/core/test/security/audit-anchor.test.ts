import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { InMemoryAuditLog } from "../../src/security/audit.js";
import { anchorAuditChain, verifyAnchor } from "../../src/security/audit-anchor.js";

let tmpDir: string;
let anchorPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "audit-anchor-"));
  anchorPath = join(tmpDir, "anchor.log");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function freshLog() {
  return new InMemoryAuditLog();
}

describe("anchorAuditChain", () => {
  it("throws when the audit table is empty", async () => {
    const log = freshLog();
    await expect(anchorAuditChain(log, anchorPath)).rejects.toThrow("empty");
  });

  it("writes a single anchor line with seq, hmac, timestamp and no previousAnchorHash for first anchor", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: { v: 1 }, at: 1 });
    await anchorAuditChain(log, anchorPath);

    const lines = readFileSync(anchorPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(1);
    const record = JSON.parse(lines[0]);
    expect(record.seq).toBe(0);
    expect(typeof record.hmac).toBe("string");
    expect(record.hmac.length).toBe(64);
    expect(typeof record.timestamp).toBe("number");
    expect(record).not.toHaveProperty("previousAnchorHash");
  });

  it("chains anchors: second anchor references hash of first", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    await log.append({ kind: "B", data: {}, at: 2 });
    await anchorAuditChain(log, anchorPath);
    await anchorAuditChain(log, anchorPath);

    const lines = readFileSync(anchorPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    const second = JSON.parse(lines[1]);
    expect(second.seq).toBe(1);
    expect(second.previousAnchorHash).toBe(createHash("sha256").update(lines[0]).digest("hex"));
  });
});

describe("verifyAnchor", () => {
  it("returns false when anchor file does not exist", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });

  it("returns true when current tip matches latest anchor", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    await anchorAuditChain(log, anchorPath);
    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(true);
  });

  it("returns false when audit chain has grown past the anchor", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    await anchorAuditChain(log, anchorPath);
    await log.append({ kind: "B", data: {}, at: 2 });
    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });

  it("returns false when anchor chain is internally broken", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    await anchorAuditChain(log, anchorPath);
    await log.append({ kind: "B", data: {}, at: 2 });
    await anchorAuditChain(log, anchorPath);

    // Tamper with first anchor line
    const lines = readFileSync(anchorPath, "utf8").trim().split("\n");
    lines[0] = lines[0].replace('"seq":0', '"seq":999');
    writeFileSync(anchorPath, lines.join("\n") + "\n", "utf8");

    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });

  it("detects tampering of the latest anchor hmac", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    await anchorAuditChain(log, anchorPath);

    const lines = readFileSync(anchorPath, "utf8").trim().split("\n");
    const record = JSON.parse(lines[0]);
    record.hmac = "f".repeat(64);
    writeFileSync(anchorPath, JSON.stringify(record) + "\n", "utf8");

    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });

  it("returns false for an empty anchor file", async () => {
    const log = freshLog();
    await log.append({ kind: "A", data: {}, at: 1 });
    writeFileSync(anchorPath, "", "utf8");
    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });

  it("returns false when the audit is empty but anchor exists", async () => {
    const log = freshLog();
    await anchorAuditChain(log, anchorPath).catch(() => {});
    writeFileSync(anchorPath, '{"seq":0,"hmac":"a","timestamp":1}\n', "utf8");
    const result = await verifyAnchor(log, anchorPath);
    expect(result.ok).toBe(false);
  });
});
