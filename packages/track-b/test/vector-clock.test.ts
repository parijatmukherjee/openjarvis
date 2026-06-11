import { describe, it, expect } from "vitest";
import { merge, compare, increment } from "../src/crdt/vector-clock.js";

describe("Vector Clock", () => {
  it("merges two clocks", () => {
    const a = { d1: 3, d2: 1 };
    const b = { d2: 2, d3: 5 };
    expect(merge(a, b)).toEqual({ d1: 3, d2: 2, d3: 5 });
  });

  it("compares equal clocks", () => {
    const a = { d1: 2 };
    const b = { d1: 2 };
    expect(compare(a, b)).toBe("equal");
  });

  it("detects before", () => {
    expect(compare({ d1: 1 }, { d1: 2 })).toBe("before");
  });

  it("detects after", () => {
    expect(compare({ d1: 3 }, { d1: 1 })).toBe("after");
  });

  it("detects concurrent", () => {
    expect(compare({ d1: 1, d2: 2 }, { d1: 2, d2: 1 })).toBe("concurrent");
  });

  it("increments a device", () => {
    expect(increment({ d1: 3 }, "d1")).toEqual({ d1: 4 });
    expect(increment({}, "d1")).toEqual({ d1: 1 });
  });
});
