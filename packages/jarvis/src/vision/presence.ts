import type { PresenceState } from "./engine.js";

export interface PresenceStateMachine {
  getState(): PresenceState;
  onTransition(handler: (oldState: PresenceState, newState: PresenceState) => void): void;
}
