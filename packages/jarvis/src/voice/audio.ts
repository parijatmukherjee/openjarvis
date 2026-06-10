export interface AudioInput {
  open(): Promise<ReadableStream<Uint8Array>>;
  close(): Promise<void>;
}

export interface AudioOutput {
  play(stream: ReadableStream<Uint8Array>): Promise<void>;
}
