import { describe, it, expectTypeOf } from "vitest";
import type { DetectionModel, DetectedObject } from "../../src/index.js";

describe("DetectionModel interface", () => {
  it("should exist as an object type", () => {
    expectTypeOf<DetectionModel>().toBeObject();
  });

  it("should have analyze method with correct signature", () => {
    type ExpectedAnalyze = (frame: Uint8Array) => Promise<DetectedObject[]>;
    expectTypeOf<DetectionModel["analyze"]>().toEqualTypeOf<ExpectedAnalyze>();
  });

  it("should have warmup method with correct signature", () => {
    type ExpectedWarmup = () => Promise<void>;
    expectTypeOf<DetectionModel["warmup"]>().toEqualTypeOf<ExpectedWarmup>();
  });

  it("should have dispose method with correct signature", () => {
    type ExpectedDispose = () => Promise<void>;
    expectTypeOf<DetectionModel["dispose"]>().toEqualTypeOf<ExpectedDispose>();
  });
});
