import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "../ui/GlassPanel";
import { NeonButton } from "../ui/NeonButton";

interface LocaleSetupProps {
  onNext: () => void;
}

const locales = [
  { code: "en-US", name: "English (US)", flag: "US" },
  { code: "en-GB", name: "English (UK)", flag: "GB" },
  { code: "es", name: "Espa\u00f1ol", flag: "ES" },
  { code: "fr", name: "Fran\u00e7ais", flag: "FR" },
  { code: "de", name: "Deutsch", flag: "DE" },
  { code: "ja", name: "\u65e5\u672c\u8a9e", flag: "JP" },
  { code: "zh", name: "\u4e2d\u6587", flag: "CN" },
];

export function LocaleSetup({ onNext }: LocaleSetupProps) {
  const [detectedLocale, setDetectedLocale] = useState<string>("en-US");
  const [selectedLocale, setSelectedLocale] = useState<string>("en-US");

  useEffect(() => {
    if (window.electronAPI?.getSystemLocale) {
      window.electronAPI.getSystemLocale().then((locale) => {
        setDetectedLocale(locale);
        setSelectedLocale(locale);
      });
    }
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-deep px-6">
      <motion.div
        className="max-w-lg w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-light tracking-tight text-center mb-2">
          Select Your Language
        </h2>
        <p className="text-text-secondary text-center mb-8">
          Detected: {locales.find((l) => l.code === detectedLocale)?.name || detectedLocale}
        </p>

        <div className="space-y-2 mb-8">
          {locales.map((locale) => (
            <GlassPanel
              key={locale.code}
              glow={selectedLocale === locale.code ? "cyan-strong" : "none"}
              onClick={() => setSelectedLocale(locale.code)}
              className={`cursor-pointer ${
                selectedLocale === locale.code ? "border-neon-cyan/40" : ""
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                <span className="text-2xl">{locale.flag}</span>
                <span className="flex-1">{locale.name}</span>
                {selectedLocale === locale.code && (
                  <motion.div
                    className="w-4 h-4 rounded-full bg-neon-cyan"
                    layoutId="locale-indicator"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
            </GlassPanel>
          ))}
        </div>

        <div className="flex justify-center">
          <NeonButton onClick={onNext}>Continue</NeonButton>
        </div>
      </motion.div>
    </div>
  );
}
