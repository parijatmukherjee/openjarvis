export interface SttEngine {
  transcribe(audioStream: ReadableStream<Uint8Array>): Promise<string>;
}
