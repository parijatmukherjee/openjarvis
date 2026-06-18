// Browser-only: uses Web Audio API

export interface AudioRecorderConfig {
  sampleRate?: number;
  fftSize?: number;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private _isRecording = false;
  private readonly sampleRate: number;
  private readonly fftSize: number;
  private amplitudeCallbacks: Set<(amplitude: number, isSpeaking: boolean) => void> = new Set();
  private animationFrameId: number | null = null;
  private pcmChunks: Uint8Array[] = [];

  constructor(config?: AudioRecorderConfig) {
    this.sampleRate = config?.sampleRate ?? 16000;
    this.fftSize = config?.fftSize ?? 256;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  async open(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: this.sampleRate },
    });

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.source.connect(this.analyser);

    this._isRecording = true;
    this.startAmplitudeLoop();
  }

  async close(): Promise<void> {
    this._isRecording = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.amplitudeCallbacks.clear();

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }

  getAmplitude(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return average / 255;
  }

  getAudioBuffer(): Uint8Array {
    const totalLength = this.pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];
    return buffer;
  }

  onAmplitude(callback: (amplitude: number, isSpeaking: boolean) => void): () => void {
    this.amplitudeCallbacks.add(callback);
    return () => {
      this.amplitudeCallbacks.delete(callback);
    };
  }

  private startAmplitudeLoop(): void {
    const loop = () => {
      if (!this._isRecording) return;
      const amplitude = this.getAmplitude();
      const isSpeaking = amplitude > 0.15;
      for (const cb of this.amplitudeCallbacks) {
        cb(amplitude, isSpeaking);
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }
}
