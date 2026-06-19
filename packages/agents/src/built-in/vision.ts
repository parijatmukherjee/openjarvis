import type { DelegatorResult } from "@openjarvis/jarvis";
import type { DetectedObject, PresenceState } from "@openjarvis/jarvis";

export interface VisionAgent {
  execute(intent: VisionIntent, context: VisionContext): Promise<VisionAgentResult>;
}

export interface VisionIntent {
  action: "vision_query" | "vision_count" | "vision_presence";
  params: Record<string, unknown>;
}

export interface VisionContext {
  sessionId: string;
  presenceState: PresenceState;
}

export interface VisionAgentResult extends DelegatorResult {
  output: {
    summary: string;
    objects: DetectedObject[];
    presence: PresenceState;
  };
}
