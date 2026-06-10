import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import type { AuditLog } from "./audit.js";

export interface AnchorRecord {
  seq: number;
  hmac: string;
  timestamp: number;
  previousAnchorHash?: string;
}

export interface VerifyAnchorResult {
  ok: boolean;
}

/** Append-only external anchor for a keyed audit chain.
 *  Reads the current tip from `audit`, then appends a JSON line to `anchorPath`. */
export async function anchorAuditChain(audit: AuditLog, anchorPath: string): Promise<void> {
  const entries = await audit.entries();
  if (entries.length === 0) {
    throw new Error("audit chain is empty");
  }
  const tip = entries[entries.length - 1];

  let previousAnchorHash: string | undefined;
  try {
    const existing = await readFile(anchorPath, "utf8");
    const lines = existing.trim().split("\n");
    if (lines.length > 0 && lines[0].length > 0) {
      const lastLine = lines[lines.length - 1];
      previousAnchorHash = createHash("sha256").update(lastLine).digest("hex");
    }
  } catch {
    // No existing anchor file — first anchor.
  }

  const record: AnchorRecord = {
    seq: tip.seq,
    hmac: tip.hash,
    timestamp: Date.now(),
    ...(previousAnchorHash ? { previousAnchorHash } : {}),
  };
  await appendFile(anchorPath, JSON.stringify(record) + "\n", "utf8");
}

/** Verify that the current audit chain tip matches the latest anchor. */
export async function verifyAnchor(
  audit: AuditLog,
  anchorPath: string,
): Promise<VerifyAnchorResult> {
  let anchorText: string;
  try {
    anchorText = await readFile(anchorPath, "utf8");
  } catch {
    return { ok: false };
  }

  const lines = anchorText.trim().split("\n");
  if (lines.length === 0 || lines[0].length === 0) {
    return { ok: false };
  }

  // Verify internal chain integrity of the anchor file.
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const current = JSON.parse(lines[i]) as AnchorRecord;
    const expectedHash = createHash("sha256").update(prev).digest("hex");
    if (current.previousAnchorHash !== expectedHash) {
      return { ok: false };
    }
  }

  const lastRecord = JSON.parse(lines[lines.length - 1]) as AnchorRecord;

  const entries = await audit.entries();
  if (entries.length === 0) {
    return { ok: false };
  }
  const tip = entries[entries.length - 1];
  return { ok: tip.seq === lastRecord.seq && tip.hash === lastRecord.hmac };
}
