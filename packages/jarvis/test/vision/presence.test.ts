import { describe, it, expectTypeOf } from "vitest";
import type { PresenceStateMachine, PresenceState } from "../../src/index.js";

describe("PresenceStateMachine interface", () => {
  it("is an object type", () => {
    expectTypeOf<PresenceStateMachine>().toBeObject();
  });

  it("has getState returning PresenceState", () => {
    expectTypeOf<PresenceStateMachine["getState"]>().returns.toEqualTypeOf<PresenceState>();
  });

  it("has onTransition with correct handler signature", () => {
    type ExpectedHandler = (oldState: PresenceState, newState: PresenceState) => void;
    expectTypeOf<PresenceStateMachine["onTransition"]>()
      .parameter(0)
      .toEqualTypeOf<ExpectedHandler>();
  });
});
