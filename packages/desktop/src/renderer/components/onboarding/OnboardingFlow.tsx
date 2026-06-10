import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WelcomeScreen } from "./WelcomeScreen";
import { LocaleSetup } from "./LocaleSetup";

const steps = ["welcome", "locale", "voice", "agents", "complete"];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        {currentStep === 0 && <WelcomeScreen onNext={handleNext} />}
        {currentStep === 1 && <LocaleSetup onNext={handleNext} />}
        {currentStep >= 2 && (
          <div className="h-screen flex items-center justify-center">
            <p className="text-text-secondary">Step {currentStep + 1} coming soon...</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
