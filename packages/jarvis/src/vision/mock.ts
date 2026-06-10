import type {
  VisionEngine,
  VisionConfig,
  VisionFrame,
  BurstOptions,
  PresenceState,
  DetectedObject,
} from "./engine.js";
import type { DetectionModel } from "./detection.js";
import type { PresenceStateMachine } from "./presence.js";

export class MockVisionEngine implements VisionEngine {
  private presenceState: PresenceState = "unknown";

  async start(_config: VisionConfig): Promise<void> {
    this.presenceState = "present";
  }

  async stop(): Promise<void> {
    this.presenceState = "unknown";
  }

  async captureBurst(options: BurstOptions): Promise<VisionFrame[]> {
    const frameCount = Math.floor((options.durationMs / 1000) * options.fps);
    const frames: VisionFrame[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push({
        frameId: `mock-frame-${i}`,
        timestamp: Date.now(),
        width: 640,
        height: 480,
        objects: [
          { label: "person", confidence: 0.92, bbox: { x: 100, y: 100, width: 200, height: 300 } },
          { label: "cup", confidence: 0.78, bbox: { x: 300, y: 300, width: 50, height: 50 } },
        ],
      });
    }
    return frames;
  }

  getPresenceState(): PresenceState {
    return this.presenceState;
  }
}

export class MockDetectionModel implements DetectionModel {
  async analyze(_frame: Uint8Array): Promise<DetectedObject[]> {
    return [
      { label: "person", confidence: 0.92, bbox: { x: 100, y: 100, width: 200, height: 300 } },
      { label: "cup", confidence: 0.78, bbox: { x: 300, y: 300, width: 50, height: 50 } },
    ];
  }

  async warmup(): Promise<void> {}
  async dispose(): Promise<void> {}
}

export class MockPresenceStateMachine implements PresenceStateMachine {
  private state: PresenceState = "unknown";
  private handlers: ((oldState: PresenceState, newState: PresenceState) => void)[] = [];

  getState(): PresenceState {
    return this.state;
  }

  setState(newState: PresenceState): void {
    const oldState = this.state;
    this.state = newState;
    if (oldState !== newState) {
      this.handlers.forEach((h) => h(oldState, newState));
    }
  }

  onTransition(handler: (oldState: PresenceState, newState: PresenceState) => void): void {
    this.handlers.push(handler);
  }
}
