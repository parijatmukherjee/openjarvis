import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { NeonButton } from "../ui/NeonButton";
import { GlassPanel } from "../ui/GlassPanel";
import { VoiceWaveform } from "../ui/VoiceWaveform";

interface VoiceCalibrationProps {
  onNext: () => void;
}

export function VoiceCalibration({ onNext }: VoiceCalibrationProps) {
  const [step, setStep] = useState<"idle" | "calibrating" | "done">("idle");
  const [confidence, setConfidence] = useState(0);
  const animFrameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const startCalibration = useCallback(() => {
    setStep("calibrating");
    startRef.current = Date.now();
    const duration = 3000;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setConfidence(progress);
      if (progress < 100) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setStep("done");
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-deep px-6">
      <motion.div
        className="max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-light tracking-tight text-center mb-2">
          Voice Calibration
        </h2>
        <p className="text-text-secondary text-center mb-8">
          {step === "idle"
            ? "Calibrate your microphone for optimal voice recognition."
            : step === "calibrating"
              ? "Listening..."
              : "Calibration complete!"}
        </p>

        <div className="flex justify-center mb-8">
          <VoiceWaveform />
        </div>

        {step !== "idle" && (
          <GlassPanel className="p-4 mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span>Confidence</span>
              <span className="text-neon-cyan">{confidence.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-neon-teal to-neon-cyan"
                animate={{ width: `${confidence}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </GlassPanel>
        )}

        <div className="flex justify-center gap-4">
          {step === "idle" && (
            <NeonButton data-testid="voice-start" onClick={startCalibration}>Start Calibration</NeonButton>
          )}
          {step === "done" && <NeonButton data-testid="voice-continue" onClick={onNext}>Continue</NeonButton>}
        </div>
      </motion.div>
    </div>
  );
}
