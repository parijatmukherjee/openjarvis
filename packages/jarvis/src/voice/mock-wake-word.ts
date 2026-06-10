import type { WakeWordEngine } from "./wake-word.js";

/**
 * Mock wake-word engine for v1. Instead of listening for a voice wake word,
 * it triggers on a programmatic call (for testing).
 *
 * v1.1: Replace with Porcupine or Whisper-based wake word detection.
 */
export class MockWakeWordEngine implements WakeWordEngine {
  private callback?: (() => Promise<void>) | undefined;
  private active = false;

  async start(callback: () => void): Promise<void> {
    // The interface signature is () => void, but the real callback may be async.
    // We store it as a Promise-returning function so trigger() can await it.
    this.callback = callback as () => Promise<void>;
    this.active = true;
  }

  /** Simulate a wake-word detection. Awaits the callback's completion. */
  async trigger(): Promise<void> {
    if (this.active && this.callback) {
      await this.callback();
    }
  }

  async stop(): Promise<void> {
    this.active = false;
    this.callback = undefined;
  }
}
