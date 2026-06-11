import { createHash } from "node:crypto";
import { merge, type VectorClock } from "./vector-clock.js";

export interface VaultEntry {
  key: string;
  value: string;
  vectorClock: VectorClock;
  conflictTombstone?: boolean;
}

const vaultStore: Map<string, VaultEntry> = new Map();

export function deriveSyncMasterKey(passphrase: string): Uint8Array {
  return createHash("sha256")
    .update(passphrase + "openjarvis-sync-v1")
    .digest();
}

export function deriveDevicePairKey(
  syncMasterKey: Uint8Array,
  deviceA: string,
  deviceB: string,
): Uint8Array {
  const input = Buffer.concat([syncMasterKey, Buffer.from(deviceA + deviceB)]);
  return createHash("sha256").update(input).digest();
}

export function storeVaultEntry(entry: VaultEntry): void {
  vaultStore.set(entry.key, entry);
}

export function getVaultEntry(key: string): VaultEntry | undefined {
  return vaultStore.get(key);
}

export function mergeVaultEntries(a: VaultEntry, b: VaultEntry): VaultEntry {
  const mergedClock = merge(a.vectorClock, b.vectorClock);

  // Determine winner: compare each entry
  const aWins = Object.entries(a.vectorClock).every(([k, v]) => (b.vectorClock[k] ?? 0) <= v);
  const bWins = Object.entries(b.vectorClock).every(([k, v]) => (a.vectorClock[k] ?? 0) <= v);

  if (aWins && !bWins) {
    return { ...a, vectorClock: mergedClock };
  }
  if (bWins && !aWins) {
    return { ...b, vectorClock: mergedClock };
  }

  // Concurrent conflict: keep both as merged entry
  return {
    key: a.key,
    value: a.value,
    vectorClock: mergedClock,
    conflictTombstone: true,
  };
}

export function clearVaultStore(): void {
  vaultStore.clear();
}
