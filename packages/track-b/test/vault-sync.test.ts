import { describe, it, expect, beforeEach } from "vitest";
import {
  deriveSyncMasterKey,
  deriveDevicePairKey,
  storeVaultEntry,
  getVaultEntry,
  mergeVaultEntries,
  clearVaultStore,
} from "../src/crdt/vault-sync.js";
import type { VaultEntry } from "../src/crdt/vault-sync.js";

describe("Vault Sync", () => {
  beforeEach(() => {
    clearVaultStore();
  });

  it("derives sync master key", () => {
    const key = deriveSyncMasterKey("passphrase");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("derives deterministic pair key", () => {
    const master = deriveSyncMasterKey("pass");
    const pair1 = deriveDevicePairKey(master, "a", "b");
    const pair2 = deriveDevicePairKey(master, "a", "b");
    expect(pair1).toEqual(pair2);
  });

  it("stores and retrieves vault entry", () => {
    const entry: VaultEntry = {
      key: "secret1",
      value: "value1",
      vectorClock: { d1: 1 },
    };
    storeVaultEntry(entry);
    expect(getVaultEntry("secret1")?.value).toBe("value1");
  });

  it("merges non-conflicting entries", () => {
    const a: VaultEntry = { key: "k", value: "a", vectorClock: { d1: 1 } };
    const b: VaultEntry = { key: "k", value: "b", vectorClock: { d1: 2 } };
    const merged = mergeVaultEntries(a, b);
    expect(merged.value).toBe("b");
    expect(merged.conflictTombstone).toBeUndefined();
  });

  it("merges with a dominating aWins", () => {
    const a: VaultEntry = { key: "k", value: "a", vectorClock: { d1: 2, d2: 1 } };
    const b: VaultEntry = { key: "k", value: "b", vectorClock: { d1: 1 } };
    const merged = mergeVaultEntries(a, b);
    expect(merged.value).toBe("a");
    expect(merged.conflictTombstone).toBeUndefined();
  });

  it("merges with b dominating bWins", () => {
    const a: VaultEntry = { key: "k", value: "a", vectorClock: { d1: 1 } };
    const b: VaultEntry = { key: "k", value: "b", vectorClock: { d1: 2 } };
    const merged = mergeVaultEntries(a, b);
    expect(merged.value).toBe("b");
    expect(merged.conflictTombstone).toBeUndefined();
  });

  it("merges identical clocks as concurrent", () => {
    const a: VaultEntry = { key: "k", value: "a", vectorClock: { d1: 1 } };
    const b: VaultEntry = { key: "k", value: "b", vectorClock: { d1: 1 } };
    const merged = mergeVaultEntries(a, b);
    expect(merged.conflictTombstone).toBe(true);
  });

  it("flags concurrent conflict", () => {
    const a: VaultEntry = { key: "k", value: "a", vectorClock: { d1: 1, d2: 2 } };
    const b: VaultEntry = { key: "k", value: "b", vectorClock: { d1: 2, d2: 1 } };
    const merged = mergeVaultEntries(a, b);
    expect(merged.conflictTombstone).toBe(true);
  });
});
