export interface WakeWordEngine {
  start(callback: () => void): Promise<void>;
  stop(): Promise<void>;
}
