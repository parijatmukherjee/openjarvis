import type { SttEngine } from "./stt.js";

export type SttErrorCode = "ollama_unavailable" | "transcription_failed";

export class SttError extends Error {
  override readonly name = "SttError" as const;
  readonly code: SttErrorCode;

  constructor(code: SttErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface OllamaSttConfig {
  baseUrl?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
}

function encodeWav(
  pcm: Uint8Array,
  sampleRate = 16000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.byteLength;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer).set(pcm, headerSize);

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export class OllamaSttEngine implements SttEngine {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config?: OllamaSttConfig) {
    this.baseUrl = config?.baseUrl ?? "http://localhost:11434";
    this.model = config?.model ?? "whisper";
    this.fetchFn = config?.fetch ?? globalThis.fetch;
  }

  async transcribe(audioStream: ReadableStream<Uint8Array>): Promise<string> {
    const pcmData = await readStream(audioStream);
    const wavData = encodeWav(pcmData);

    const formData = new FormData();
    formData.append("file", new Blob([wavData], { type: "audio/wav" }), "audio.wav");
    formData.append("model", this.model);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/api/transcribe`, {
        method: "POST",
        body: formData,
      });
    } catch (err: unknown) {
      throw new SttError(
        "ollama_unavailable",
        `Cannot connect to Ollama at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new SttError(
        "transcription_failed",
        `Ollama transcription failed (HTTP ${response.status}): ${await response.text().catch(() => "")}`,
      );
    }

    const json = (await response.json()) as { text?: string };
    return json.text ?? "";
  }
}
