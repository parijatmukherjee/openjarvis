import { createHash } from "node:crypto";
import { redact } from "./redact.js";

/**
 * Murray — append-only, hash-chained audit (spec §8.5). Every grounding decision,
 * tool call, and correction is recorded; `entry.hash = H(prevHash + canonical(entry))`
 * so any later edit to a past entry breaks the chain and `verify()` returns false.
 * Secrets are redacted on the way in. In-memory + JSONL in S1; durable in S2.
 */
export interface AuditInput {
  kind: string;
  data: Record<string, unknown>;
  at: number;
}

export interface AuditEntry extends AuditInput {
  seq: number;
  prevHash: string;
  hash: string;
}

export interface AuditLog {
  append(input: AuditInput): Promise<AuditEntry>;
  entries(): Promise<AuditEntry[]>;
  verify(): Promise<boolean>;
}

const GENESIS = "0".repeat(64);

/** Deterministic hash of an entry's content chained onto the previous hash. */
export function hashEntry(
  prevHash: string,
  e: { seq: number; at: number; kind: string; data: unknown },
): string {
  const canonical = JSON.stringify([e.seq, e.at, e.kind, e.data]);
  return createHash("sha256")
    .update(prevHash + canonical)
    .digest("hex");
}

export class InMemoryAuditLog implements AuditLog {
  private readonly log: AuditEntry[] = [];

  async append(input: AuditInput): Promise<AuditEntry> {
    const prevHash = this.log.length > 0 ? this.log[this.log.length - 1].hash : GENESIS;
    const seq = this.log.length;
    // Redact secrets BEFORE hashing so the chain commits to the redacted form.
    const data = redact(input.data) as Record<string, unknown>;
    const base = { seq, at: input.at, kind: input.kind, data };
    const entry: AuditEntry = { ...base, prevHash, hash: hashEntry(prevHash, base) };
    this.log.push(entry);
    return entry;
  }

  async entries(): Promise<AuditEntry[]> {
    return [...this.log];
  }

  async verify(): Promise<boolean> {
    let prev = GENESIS;
    for (const e of this.log) {
      if (e.prevHash !== prev) {
        return false;
      }
      const expected = hashEntry(prev, { seq: e.seq, at: e.at, kind: e.kind, data: e.data });
      if (e.hash !== expected) {
        return false;
      }
      prev = e.hash;
    }
    return true;
  }
}
