export interface TtsEngine {
  synthesize(text: string): Promise<ReadableStream<Uint8Array>>;
}
