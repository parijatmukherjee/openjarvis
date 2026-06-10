import type { DetectedObject } from "./engine.js";

export interface DetectionModel {
  analyze(frame: Uint8Array): Promise<DetectedObject[]>;
  warmup(): Promise<void>;
  dispose(): Promise<void>;
}
