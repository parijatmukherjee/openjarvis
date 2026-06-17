# Conversational Voice Pipeline — Design Spec

> **Date:** 2026-06-17
> **Status:** Draft
> **Scope:** Single PR — wire real mic input, Ollama Whisper STT, amplitude-based VAD, barge-in, hub integration

## 1. Problem

The desktop app has a `VoiceWaveform` component that renders concentric animated rings, but the underlying `useAudioAnalysis` hook never calls `startAnalysis()`. The waveform is always idle. There is no speech-to-text, no wake word detection, and no connection between voice input and the Jarvis agent loop.

## 2. Goal

Make the desktop app conversational:

1. The mic is always listening (with user permission).
2. When the user speaks above an amplitude threshold, the system switches from idle to listening.
3. Audio is buffered during listening and sent to Ollama Whisper for transcription.
4. The transcript flows into `JarvisHub` via the `readInputOverride` seam.
5. When the AI is speaking/responding and the user starts talking again, the AI stops (barge-in).
6. `VoiceWaveform` visually reflects all states: idle, listening, thinking, responding.

## 3. Architecture

### 3.1 Package responsibilities

| Package               | Responsibility                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openjarvis/jarvis`  | `OllamaSttEngine` (implements `SttEngine`) — pure Node, HTTP to Ollama                                                                                                                                                                                        |
| `@openjarvis/desktop` | `AudioRecorder` (Web Audio mic capture + buffering), `AmplitudeWakeWordEngine` (implements `WakeWordEngine`), `useVoicePipeline` hook (orchestrates mic → VAD → STT), `VoiceWaveform` visual states, `NexusBridge` voice methods, IPC channel for voice state |

### 3.2 Data flow

```
Mic (Web Audio API)
  → AudioRecorder (captures MediaStream, buffers PCM chunks)
    → AmplitudeWakeWordEngine (detects voice activity via amplitude threshold)
      → State: IDLE → LISTENING
    → OllamaSttEngine (sends buffered WAV to POST /api/transcribe)
      → Transcript: string
        → NexusBridge.sendTranscript(transcript)
          → JarvisHub.readInputOverride()
            → IntentParser → Delegator → Synthesizer → TTS
              → State: THINKING → RESPONDING → IDLE
Barge-in:
  AmplitudeWakeWordEngine detects speech during RESPONDING
    → Interrupt current response
    → State: RESPONDING → LISTENING
```

### 3.3 State machine

```
IDLE ──(speech detected)──→ LISTENING ──(transcript received)──→ THINKING ──(response ready)──→ RESPONDING ──(response complete)──→ IDLE
  ↑                                                                                                │
  └──(barge-in: speech detected during RESPONDING)────────────────────────────────────────────────┘
```

States map to `JarvisHub.currentState` plus a new `VoiceState` in the desktop renderer:

| VoiceState   | JarvisHub state | Visual                           |
| ------------ | --------------- | -------------------------------- |
| `idle`       | `idle`          | Dim rings, no glow               |
| `listening`  | `listening`     | Bright pulsing rings, mic icon   |
| `thinking`   | `thinking`      | Subtle pulse, thinking indicator |
| `responding` | `responding`    | Steady glow, response text       |

## 4. Components

### 4.1 `OllamaSttEngine` (new: `@openjarvis/jarvis/src/voice/ollama-stt.ts`)

Implements `SttEngine.transcribe(audioStream)`:

- Accepts a `ReadableStream<Uint8Array>` of raw PCM audio
- Converts PCM to WAV (16kHz mono, 16-bit) in memory
- POSTs to `http://localhost:11434/api/transcribe` with the model `whisper` (configurable)
- Returns the transcribed text string
- Constructor accepts `OllamaSttConfig: { baseUrl?: string; model?: string }`
- Default base URL: `http://localhost:11434`
- Default model: `whisper`
- Throws `SttError` with a `code` field (`'ollama_unavailable'` | `'transcription_failed'`) on failure

```ts
export interface OllamaSttConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaSttEngine implements SttEngine {
  constructor(config?: OllamaSttConfig);
  async transcribe(audioStream: ReadableStream<Uint8Array>): Promise<string>;
}
```

### 4.2 `AmplitudeWakeWordEngine` (new: `@openjarvis/desktop/src/renderer/voice/amplitude-wake-word.ts`)

Implements `WakeWordEngine` using a simple amplitude threshold on an `AudioRecorder`:

- `start(callback)`: begins monitoring mic amplitude. When amplitude exceeds threshold for sustained duration (200ms), fires callback.
- `stop()`: stops monitoring.
- Constructor accepts `AmplitudeWakeWordConfig: { threshold?: number; sustainedMs?: number; recorder: AudioRecorder }`
- Default threshold: 0.15 (matching current `useAudioAnalysis` logic)
- Default sustained: 200ms (avoids brief noise triggers)
- Also emits events for barge-in detection: when amplitude exceeds threshold while in RESPONDING state

```ts
export interface AmplitudeWakeWordConfig {
  threshold?: number;
  sustainedMs?: number;
  recorder: AudioRecorder;
}

export class AmplitudeWakeWordEngine implements WakeWordEngine {
  constructor(config: AmplitudeWakeWordConfig);
  async start(callback: () => void): Promise<void>;
  async stop(): Promise<void>;
  onBargeIn(callback: () => void): void;
}
```

### 4.3 `AudioRecorder` (new: `@openjarvis/desktop/src/renderer/voice/audio-recorder.ts`)

Manages the microphone MediaStream and provides:

- `open()`: requests mic access, creates AudioContext + AnalyserNode, starts recording PCM chunks
- `close()`: stops recording, releases mic, cleans up AudioContext
- `getAmplitude()`: returns current RMS amplitude (0–1) from AnalyserNode
- `getAudioBuffer()`: returns buffered WAV audio since last call (clears buffer)
- `onAmplitude(callback)`: registers a callback invoked every animation frame with current amplitude

```ts
export interface AudioRecorderConfig {
  sampleRate?: number;
  fftSize?: number;
}

export class AudioRecorder {
  constructor(config?: AudioRecorderConfig);
  async open(): Promise<void>;
  async close(): Promise<void>;
  getAmplitude(): number;
  getAudioBuffer(): Uint8Array;
  onAmplitude(callback: (amplitude: number, isSpeaking: boolean) => void): () => void;
  get isRecording(): boolean;
}
```

### 4.4 `useVoicePipeline` (new: `@openjarvis/desktop/src/renderer/hooks/useVoicePipeline.ts`)

Replaces `useAudioAnalysis`. Orchestrates the full voice pipeline:

```ts
export type VoiceState = "idle" | "listening" | "thinking" | "responding";

export interface VoicePipelineState {
  voiceState: VoiceState;
  amplitude: number;
  isSpeaking: boolean;
  transcript: string | null;
  error: string | null;
}

export function useVoicePipeline(): {
  state: VoicePipelineState;
  startListening: () => Promise<void>;
  stopListening: () => void;
  interrupt: () => void;
};
```

- On mount: requests mic permission, creates `AudioRecorder`
- Exposes `startListening()` / `stopListening()` for explicit control
- When `startListening()` is called, starts buffering audio and monitoring amplitude
- When amplitude drops below threshold for 1.5s (end-of-speech detection), flushes buffer to STT
- On transcript received, calls `NexusBridge.sendTranscript(text)`
- Subscribes to `NexusBridge.onVoiceStateChange` to sync with hub state
- `interrupt()`: cancels current AI response, transitions back to listening
- Falls back to amplitude-only mode if mic permission denied or Ollama unavailable

### 4.5 `NexusBridge` voice extensions

Add to `NexusBridge` interface in `nexus-types.ts`:

```ts
export interface NexusBridge {
  // ...existing methods...
  sendTranscript(text: string): Promise<void>;
  onVoiceStateChange(handler: (state: VoiceState) => void): () => void;
  interrupt(): void;
}
```

The `sendTranscript` method pipes text into the JarvisHub via `readInputOverride`.
The `onVoiceStateChange` method subscribes to hub state transitions via the EventBus.

### 4.6 `VoiceWaveform` visual states

Update `VoiceWaveform.tsx` to consume `useVoicePipeline` instead of `useAudioAnalysis`:

```tsx
const { state } = useVoicePipeline();
const { amplitude, voiceState } = state;

// Visual mapping:
// idle: dim rings, no glow
// listening: bright pulsing rings, cyan glow
// thinking: subtle pulse, teal glow
// responding: steady warm glow, text displayed
```

### 4.7 IPC channel for voice state

Add an IPC channel `voice:state` so the main process can track voice state for system tray indicators:

- `voice:state` — renderer sends state changes to main process
- Main process stores voice state for future system tray integration

## 5. Error handling

| Scenario                    | Behavior                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Mic permission denied       | Fall back to amplitude-only mode (random low amplitude). Show toast asking for mic permission. |
| Ollama unavailable          | Fall back to text-only mode. Show toast "Ollama not running — voice input disabled."           |
| Transcription fails         | Show toast with error. Stay in listening state so user can retry.                              |
| No speech detected after 5s | Auto-transition back to idle. Don't send empty transcript.                                     |

## 6. Testing strategy

| Component                 | Test approach                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `OllamaSttEngine`         | Mock `fetch` to Ollama API. Test WAV conversion, error codes, retry.                                                       |
| `AmplitudeWakeWordEngine` | Mock `AudioRecorder.getAmplitude()`. Test threshold crossing, sustained detection, barge-in callback.                      |
| `AudioRecorder`           | Mock Web Audio API (`AudioContext`, `AnalyserNode`, `MediaStream`). Test open/close, amplitude reading, buffer collection. |
| `useVoicePipeline`        | Hook test with mock `NexusBridge`. Test state transitions, end-of-speech detection, interrupt, error fallback.             |
| `VoiceWaveform`           | Component test with mock `useVoicePipeline`. Test visual states.                                                           |
| Integration               | Mock Ollama + real `JarvisHub` config. Test full lifecycle: wake → listen → transcribe → think → respond → idle.           |

## 7. Dependencies

| Dependency            | Purpose                                      | Package                      |
| --------------------- | -------------------------------------------- | ---------------------------- |
| Ollama server         | Whisper STT inference                        | External (user runs locally) |
| `@openjarvis/jarvis`  | SttEngine, WakeWordEngine, AudioRecorder     | Already in monorepo          |
| `@openjarvis/desktop` | useVoicePipeline, VoiceWaveform, NexusBridge | Already in monorepo          |

No new npm dependencies required. Ollama is an external service the user runs locally.

## 8. Out of scope

- True wake word detection (e.g., "Hey Jarvis") — v2.0
- TTS (text-to-speech) output — separate PR
- System tray indicator — future PR
- Continuous always-on listening without user action — v2.0 (current version requires user to click mic or use hotkey)
- Speaker diarization (identifying who is speaking)
- Multiple language support beyond English

## 9. Future iterations

- **v2.0:** True wake word ("Hey Jarvis") via Porcupine or similar
- **v2.1:** TTS via Piper for spoken responses
- **v2.2:** Always-on listening mode
- **v3.0:** Multi-language STT
