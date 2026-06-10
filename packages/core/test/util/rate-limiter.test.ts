import { describe, it, expect } from "vitest";
import { tokenBucket, calculateBackoff } from "../../src/util/rate-limiter.js";

describe("tokenBucket", () => {
  it("allows requests within capacity and denies excess", () => {
    const limiter = tokenBucket("key1", { capacity: 2, refillRate: 1 });
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });

  it("refills tokens over time", async () => {
    const limiter = tokenBucket("key2", { capacity: 1, refillRate: 10 }); // 10 per second
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    expect(limiter.allow()).toBe(true);
  });

  it("isolates keys", () => {
    const a = tokenBucket("a", { capacity: 1, refillRate: 1 });
    const b = tokenBucket("b", { capacity: 1, refillRate: 1 });
    expect(a.allow()).toBe(true);
    expect(b.allow()).toBe(true);
  });
});

describe("calculateBackoff", () => {
  it("returns baseMs on the first attempt", () => {
    expect(calculateBackoff(0, 100)).toBeGreaterThanOrEqual(100);
    expect(calculateBackoff(0, 100)).toBeLessThan(200);
  });

  it("doubles with each attempt (exponential)", () => {
    expect(calculateBackoff(1, 100)).toBeGreaterThanOrEqual(200);
    expect(calculateBackoff(1, 100)).toBeLessThan(400);
    expect(calculateBackoff(2, 100)).toBeGreaterThanOrEqual(400);
    expect(calculateBackoff(2, 100)).toBeLessThan(800);
  });

  it("adds jitter so successive calls differ", () => {
    const samples = Array.from({ length: 10 }, () => calculateBackoff(1, 100));
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("bounds jitter to the current interval", () => {
    for (let i = 0; i < 20; i++) {
      const v = calculateBackoff(2, 50);
      expect(v).toBeGreaterThanOrEqual(200);
      expect(v).toBeLessThan(400);
    }
  });
});
