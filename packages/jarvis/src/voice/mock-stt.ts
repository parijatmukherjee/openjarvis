import type { SttEngine } from "./stt.js";

/**
 * Mock STT engine for v1. Instead of transcribing audio, it returns a
 * pre-configured text string (for deterministic testing) or reads from a
 * provided input queue.
 *
 * v1.1: Replace with Whisper-small local transcription.
 */
export class MockSttEngine implements SttEngine {
  constructor(private readonly responses: string[] = []) {}
  private cursor = 0;

  async transcribe(): Promise<string> {
    const text = this.responses[this.cursor] ?? "";
    this.cursor = (this.cursor + 1) % Math.max(this.responses.length, 1);
    return text;
  }

  /** Push a response for the next transcription (for interactive testing). */
  enqueue(response: string): void {
    this.responses.push(response);
  }
}
