import { useState, useRef, useCallback } from "react";
import { useNexus } from "../../contexts/NexusContext";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export function VoiceConversation() {
  const nexus = useNexus();
  const [state, setState] = useState<VoiceState>("idle");
  const [amplitude, setAmplitude] = useState(0.1);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      void nexus.executeIntent("chat", { text: "Hello Jarvis" }).then(() => {
        setState("idle");
      });
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onaudiostart = () => {
      setState("listening");
    };

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(text);
      setState("thinking");

      void nexus
        .executeIntent("chat", { text })
        .then((result: unknown) => {
          const r = result as { spoken?: string } | undefined;
          setResponse(r?.spoken ?? "Done.");
          setState("idle");
        })
        .catch(() => {
          setResponse("I encountered an error.");
          setState("idle");
        });
    };

    recognition.onerror = () => {
      setState("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (state !== "listening") return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
          setAmplitude(avg);
          requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        setAmplitude(0.15);
      });
  }, [nexus, state]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState("idle");
  }, []);

  const toggleListening = useCallback(() => {
    if (state === "idle") {
      startListening();
    } else if (state === "listening") {
      stopListening();
    }
  }, [state, startListening, stopListening]);

  const stateLabels: Record<VoiceState, string> = {
    idle: "PUSH TO TALK",
    listening: "LISTENING...",
    thinking: "PROCESSING...",
    speaking: "SPEAKING...",
  };

  const ringScales = [0.35, 0.55, 0.75, 0.9, 1.0];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center w-48 h-48">
        {ringScales.map((scale, i) => (
          <div
            key={i}
            className="absolute rounded-full border transition-all duration-200"
            style={{
              width: `${scale * 100}%`,
              height: `${scale * 100}%`,
              borderColor:
                state === "listening"
                  ? `rgba(0, 212, 255, ${0.15 + amplitude * 0.6})`
                  : state === "thinking"
                    ? "rgba(255, 171, 0, 0.3)"
                    : "rgba(0, 212, 255, 0.15)",
              transform: state === "listening" ? `scale(${1 + amplitude * 0.15})` : "scale(1)",
            }}
          />
        ))}

        <button
          onClick={toggleListening}
          className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{
            background:
              state === "idle"
                ? "rgba(0, 212, 255, 0.15)"
                : state === "listening"
                  ? "rgba(0, 212, 255, 0.3)"
                  : "rgba(255, 171, 0, 0.2)",
            boxShadow:
              state === "listening"
                ? `0 0 ${20 + amplitude * 30}px rgba(0, 212, 255, ${0.3 + amplitude * 0.4})`
                : "0 0 20px rgba(0, 212, 255, 0.2)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neon-cyan"
          >
            {state === "thinking" ? (
              <circle cx="12" cy="12" r="10" opacity="0.3" />
            ) : (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            )}
          </svg>
        </button>
      </div>

      <span className="text-xs tracking-widest text-neon-cyan/60 uppercase">
        {stateLabels[state]}
      </span>

      {(transcript || response) && (
        <div className="w-full max-w-xs space-y-2">
          {transcript && (
            <div className="text-xs text-white/80 text-right">
              <span className="text-[#0088ff] text-[10px] tracking-wider">USER_ // </span>
              {transcript}
            </div>
          )}
          {response && (
            <div className="text-xs text-neon-cyan text-left">
              <span className="text-[#00aaff] text-[10px] tracking-wider">J.A.R.V.I.S_ // </span>
              {response}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
