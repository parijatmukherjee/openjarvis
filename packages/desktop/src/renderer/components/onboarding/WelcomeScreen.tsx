import { motion } from "framer-motion";
import { NeonButton } from "../ui/NeonButton";

interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-deep">
      {/* Animated rings */}
      <div className="relative mb-8">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-neon-cyan/20"
            style={{
              width: `${i * 80}px`,
              height: `${i * 80}px`,
              top: `${-i * 40 + 40}px`,
              left: `${-i * 40 + 40}px`,
            }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{
              duration: 3,
              delay: i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        <motion.h1
          className="text-6xl font-light tracking-tighter text-neon-cyan relative z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        >
          JARVIS
        </motion.h1>
      </div>

      <motion.p
        className="text-xl text-text-secondary mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Your Personal AI Assistant
      </motion.p>

      <motion.p
        className="text-sm text-text-secondary mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        Initialize to begin
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        <NeonButton onClick={onNext}>Initialize</NeonButton>
      </motion.div>
    </div>
  );
}
