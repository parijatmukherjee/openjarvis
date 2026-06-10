import type { TtsEngine } from "./tts.js";

/**
 * Mock TTS engine for v1. Instead of synthesizing audio, it captures spoken
 * text to a callback (for testing/assertions) and returns an empty stream.
 *
 * v1.1: Replace with Piper TTS (fast, local, small models).
 */
export class MockTtsEngine implements TtsEngine {
  private spoken: string[] = [];

  async synthesize(text: string): Promise<ReadableStream<Uint8Array>> {
    this.spoken.push(text);
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  }

  /** All text spoken since the last clear (for test assertions). */
  getSpoken(): string[] {
    return [...this.spoken];
  }

  clear(): void {
    this.spoken = [];
  }
}
