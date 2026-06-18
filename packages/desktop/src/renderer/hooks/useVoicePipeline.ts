// Browser-only: uses Web Audio API

import { useState, useEffect, useRef, useCallback } from "react";
import { AudioRecorder } from "../voice/audio-recorder.js";
import { AmplitudeWakeWordEngine } from "../voice/amplitude-wake-word.js";

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
} {
  const [state, setState] = useState<VoicePipelineState>({
    voiceState: "idle",
    amplitude: 0,
    isSpeaking: false,
    transcript: null,
    error: null,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const wakeWordRef = useRef<AmplitudeWakeWordEngine | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  const endOfSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndOfSpeechTimer = useCallback(() => {
    if (endOfSpeechTimerRef.current !== null) {
      clearTimeout(endOfSpeechTimerRef.current);
      endOfSpeechTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      const recorder = recorderRef.current;

      if (!recorder.isRecording) {
        await recorder.open();
      }

      const wakeWord = new AmplitudeWakeWordEngine({ recorder });
      wakeWordRef.current = wakeWord;

      stateRef.current = "listening";
      setState((prev) => ({ ...prev, voiceState: "listening", error: null }));

      await wakeWord.start(() => {
        stateRef.current = "thinking";
        setState((prev) => ({ ...prev, voiceState: "thinking" }));
      });

      wakeWord.onBargeIn(() => {
        stateRef.current = "listening";
        setState((prev) => ({ ...prev, voiceState: "listening" }));
        clearEndOfSpeechTimer();
      });

      recorder.onAmplitude((amplitude, isSpeaking) => {
        setState((prev) => ({ ...prev, amplitude, isSpeaking }));

        if (stateRef.current === "listening" && !isSpeaking) {
          clearEndOfSpeechTimer();
          endOfSpeechTimerRef.current = setTimeout(() => {
            if (stateRef.current === "listening") {
              const audioBuffer = recorder.getAudioBuffer();
              if (audioBuffer.length > 0) {
                stateRef.current = "thinking";
                setState((prev) => ({
                  ...prev,
                  voiceState: "thinking",
                  transcript: null,
                }));
              }
            }
          }, 1500);
        } else if (isSpeaking) {
          clearEndOfSpeechTimer();
        }
      });
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [clearEndOfSpeechTimer]);

  const stopListening = useCallback(() => {
    clearEndOfSpeechTimer();
    if (wakeWordRef.current) {
      void wakeWordRef.current.stop();
      wakeWordRef.current = null;
    }
    if (recorderRef.current?.isRecording) {
      void recorderRef.current.close();
    }
    stateRef.current = "idle";
    setState((prev) => ({
      ...prev,
      voiceState: "idle",
      amplitude: 0,
      isSpeaking: false,
    }));
  }, [clearEndOfSpeechTimer]);

  const interrupt = useCallback(() => {
    clearEndOfSpeechTimer();
    stateRef.current = "listening";
    setState((prev) => ({
      ...prev,
      voiceState: "listening",
      transcript: null,
    }));
  }, [clearEndOfSpeechTimer]);

  useEffect(() => {
    return () => {
      clearEndOfSpeechTimer();
      if (wakeWordRef.current) {
        void wakeWordRef.current.stop();
      }
      if (recorderRef.current?.isRecording) {
        void recorderRef.current.close();
      }
    };
  }, [clearEndOfSpeechTimer]);

  return { state, startListening, stopListening, interrupt };
}
