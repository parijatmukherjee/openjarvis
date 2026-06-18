// Browser-only: uses Web Audio API

import type { AudioRecorder } from "./audio-recorder.js";

export interface AmplitudeWakeWordConfig {
  threshold?: number;
  sustainedMs?: number;
  recorder: AudioRecorder;
}

export class AmplitudeWakeWordEngine {
  private readonly threshold: number;
  private readonly sustainedMs: number;
  private readonly recorder: AudioRecorder;
  private active = false;
  private wakeCallback: (() => void) | null = null;
  private bargeInCallbacks: Set<() => void> = new Set();
  private sustainedSince: number | null = null;
  private unsubscribeAmplitude: (() => void) | null = null;
  private monitoring = false;
  private lastAmplitude = 0;
  private respondState = false;
  private cooldown = false;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AmplitudeWakeWordConfig) {
    this.threshold = config.threshold ?? 0.15;
    this.sustainedMs = config.sustainedMs ?? 200;
    this.recorder = config.recorder;
  }

  async start(callback: () => void): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.wakeCallback = callback;
    this.sustainedSince = null;
    this.monitoring = true;

    this.unsubscribeAmplitude = this.recorder.onAmplitude((amplitude, _isSpeaking) => {
      this.lastAmplitude = amplitude;
      if (!this.monitoring) return;

      const now = Date.now();

      if (amplitude >= this.threshold) {
        if (this.respondState) {
          for (const cb of this.bargeInCallbacks) {
            cb();
          }
        }

        if (this.sustainedSince === null) {
          this.sustainedSince = now;
        } else if (now - this.sustainedSince >= this.sustainedMs) {
          if (this.cooldown) return;
          if (this.wakeCallback) {
            this.wakeCallback();
          }
          this.sustainedSince = null;
          this.cooldown = true;
          this.cooldownTimer = setTimeout(() => {
            this.cooldown = false;
          }, 1000);
        }
      } else {
        this.sustainedSince = null;
      }
    });
  }

  async stop(): Promise<void> {
    this.active = false;
    this.monitoring = false;
    this.wakeCallback = null;
    this.sustainedSince = null;
    this.cooldown = false;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    if (this.unsubscribeAmplitude) {
      this.unsubscribeAmplitude();
      this.unsubscribeAmplitude = null;
    }
  }

  onBargeIn(callback: () => void): () => void {
    this.bargeInCallbacks.add(callback);
    return () => {
      this.bargeInCallbacks.delete(callback);
    };
  }

  setResponding(responding: boolean): void {
    this.respondState = responding;
  }

  getLastAmplitude(): number {
    return this.lastAmplitude;
  }
}
