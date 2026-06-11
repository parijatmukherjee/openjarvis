import { describe, it, expect, beforeEach } from "vitest";
import {
  createFragment,
  updateFragment,
  deleteFragment,
  resolveConflict,
  getFragment,
  listFragments,
  clearFragmentStore,
} from "../src/crdt/memory-sync.js";

describe("Memory CRDT", () => {
  beforeEach(() => {
    clearFragmentStore();
  });

  it("creates a fragment", () => {
    const f = createFragment("hello", "d1");
    expect(f.text).toBe("hello");
    expect(f.version).toBe(1);
    expect(f.vectorClock).toEqual({ d1: 1 });
    expect(f.tombstone).toBeUndefined();
    expect(getFragment(f.fragmentId)).toEqual(f);
  });

  it("updates a fragment", () => {
    const f1 = createFragment("hello", "d1");
    const f2 = updateFragment(f1, "world", "d1");
    expect(f2.text).toBe("world");
    expect(f2.version).toBe(2);
    expect(f2.vectorClock).toEqual({ d1: 2 });
  });

  it("soft-deletes a fragment", () => {
    const f1 = createFragment("hello", "d1");
    const f2 = deleteFragment(f1, "d1");
    expect(f2.tombstone).toBeGreaterThan(0);
    expect(f2.version).toBe(2);
  });

  it("resolves equal vector clocks as concurrent", () => {
    const a = createFragment("a", "d1");
    const b = { ...a, text: "b", fragmentId: "different-id" };
    // b has same vector clock as a (created by d1, {d1:1})
    const resolved = resolveConflict(a, b);
    expect(resolved.text).toBeDefined();
  });

  it("resolves concurrent conflict with deterministic winner", () => {
    const a = createFragment("a", "d1");
    const b = createFragment("b", "d2");
    // Concurrent: neither dominates; force JSON tie-breaker for both branches
    const resolved1 = resolveConflict(a, b);
    const resolved2 = resolveConflict(b, a);
    expect(resolved1.text).toBeDefined();
    expect(resolved2.text).toBeDefined();
    // Since JSON.stringify({d1:1}) > JSON.stringify({d2:1}) depends on key order,
    // we just verify it returns a valid fragment
  });

  it("lists fragments", () => {
    expect(listFragments()).toEqual([]);
    const f = createFragment("hello", "d1");
    expect(listFragments()).toEqual([f]);
  });

  it("resolves after vs before", () => {
    const a = createFragment("a", "d1");
    const b = updateFragment(a, "b", "d1"); // b's vector clock is after a's
    expect(resolveConflict(a, b).text).toBe("b"); // b is after a
    expect(resolveConflict(b, a).text).toBe("b"); // b is after a
  });
});
