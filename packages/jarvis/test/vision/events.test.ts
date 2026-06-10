import { describe, it, expectTypeOf } from "vitest";
import type { VisionEvent, VisionEventType, BusEvent } from "../../src/index.js";

describe("VisionEvent interface", () => {
  it("extends BusEvent", () => {
    expectTypeOf<VisionEvent>().toMatchTypeOf<BusEvent>();
  });

  it("has correct topic literal", () => {
    expectTypeOf<VisionEvent["topic"]>().toEqualTypeOf<"vision">();
  });

  it("has payload with correct structure", () => {
    expectTypeOf<VisionEvent["payload"]>().toBeObject();
    expectTypeOf<VisionEvent["payload"]["frameId"]>().toBeString();
    expectTypeOf<VisionEvent["payload"]["objects"]>().toBeArray();
    expectTypeOf<VisionEvent["payload"]["presenceState"]>().toBeString();
    expectTypeOf<VisionEvent["payload"]["confidence"]>().toBeNumber();
  });
});

describe("VisionEventType union", () => {
  it("includes all 5 literals", () => {
    expectTypeOf<VisionEventType>().toEqualTypeOf<
      "frame" | "presence_change" | "object_entered" | "object_exited" | "alert"
    >();
  });
});
