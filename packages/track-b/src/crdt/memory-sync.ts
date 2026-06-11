import { randomUUID } from "node:crypto";
import type { VectorClock } from "./vector-clock.js";
import { compare, increment } from "./vector-clock.js";

export interface SyncableFragment {
  fragmentId: string;
  version: number;
  vectorClock: VectorClock;
  text: string;
  createdAt: number;
  tombstone?: number;
}

const fragmentStore: Map<string, SyncableFragment> = new Map();

export function createFragment(text: string, deviceId: string): SyncableFragment {
  const fragment: SyncableFragment = {
    fragmentId: randomUUID(),
    version: 1,
    vectorClock: { [deviceId]: 1 },
    text,
    createdAt: Date.now(),
  };
  fragmentStore.set(fragment.fragmentId, fragment);
  return fragment;
}

export function updateFragment(
  fragment: SyncableFragment,
  text: string,
  deviceId: string,
): SyncableFragment {
  const updated: SyncableFragment = {
    ...fragment,
    version: fragment.version + 1,
    vectorClock: increment(fragment.vectorClock, deviceId),
    text,
  };
  fragmentStore.set(updated.fragmentId, updated);
  return updated;
}

export function deleteFragment(fragment: SyncableFragment, deviceId: string): SyncableFragment {
  const updated: SyncableFragment = {
    ...fragment,
    version: fragment.version + 1,
    vectorClock: increment(fragment.vectorClock, deviceId),
    tombstone: Date.now(),
  };
  fragmentStore.set(updated.fragmentId, updated);
  return updated;
}

export function resolveConflict(a: SyncableFragment, b: SyncableFragment): SyncableFragment {
  const cmp = compare(a.vectorClock, b.vectorClock);
  if (cmp === "after" || cmp === "equal") return a;
  if (cmp === "before") return b;
  // Concurrent: compare JSON of vector clocks as tie-breaker
  return JSON.stringify(a.vectorClock) > JSON.stringify(b.vectorClock) ? a : b;
}

export function getFragment(id: string): SyncableFragment | undefined {
  return fragmentStore.get(id);
}

export function listFragments(): SyncableFragment[] {
  return Array.from(fragmentStore.values());
}

export function clearFragmentStore(): void {
  fragmentStore.clear();
}
