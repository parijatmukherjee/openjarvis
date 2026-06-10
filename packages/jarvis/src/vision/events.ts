import type { BusEvent } from "../event-bus.js";
import type { DetectedObject, PresenceState } from "./engine.js";

export interface VisionEvent extends BusEvent {
  topic: "vision";
  type: VisionEventType;
  payload: {
    frameId: string;
    objects: DetectedObject[];
    presenceState: PresenceState;
    confidence: number;
  };
}

export type VisionEventType = "frame" | "presence_change" | "object_entered" | "object_exited" | "alert";
