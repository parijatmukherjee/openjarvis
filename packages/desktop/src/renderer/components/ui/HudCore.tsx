import { useNexus } from "../../contexts/NexusContext";
import { useState, useEffect } from "react";

export function HudCore() {
  const nexus = useNexus();
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const checkWorking = async () => {
      try {
        const tasks = await nexus.getTasks();
        const hasActive = tasks.some((t) => t.status === "running");
        setIsWorking(hasActive);
      } catch {
        setIsWorking(false);
      }
    };
    checkWorking();
    const interval = setInterval(checkWorking, 2000);
    return () => clearInterval(interval);
  }, [nexus]);

  return (
    <div className={`hud-core ${isWorking ? "working" : ""}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
        <defs>
          <filter id="hudGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#hudGlow)">
          <line
            x1="250"
            y1="30"
            x2="250"
            y2="470"
            stroke="var(--neon-cyan)"
            strokeWidth="0.5"
            opacity="0.2"
          />
          <line
            x1="30"
            y1="250"
            x2="470"
            y2="250"
            stroke="var(--neon-cyan)"
            strokeWidth="0.5"
            opacity="0.2"
          />

          <g className="ring hud-layer-5">
            <circle
              cx="250"
              cy="250"
              r="235"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="1"
              strokeDasharray="2 12"
              opacity="0.4"
            />
            <path
              d="M 40 250 A 210 210 0 0 1 100 100"
              fill="none"
              stroke="#00aaff"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <path
              d="M 460 250 A 210 210 0 0 1 400 400"
              fill="none"
              stroke="#00aaff"
              strokeWidth="1.5"
              opacity="0.5"
            />
          </g>

          <g className="ring hud-layer-1">
            <circle
              cx="250"
              cy="250"
              r="200"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="2"
              strokeDasharray="3 7"
              opacity="0.7"
            />
            <circle
              cx="250"
              cy="250"
              r="206"
              fill="none"
              stroke="#0088ff"
              strokeWidth="1"
              strokeDasharray="1 15"
              opacity="0.9"
            />
            <circle
              cx="250"
              cy="250"
              r="190"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="3"
              strokeDasharray="120 180"
              opacity="0.4"
            />
          </g>

          <g className="ring hud-layer-2">
            <circle
              cx="250"
              cy="250"
              r="160"
              fill="none"
              stroke="#00d2ff"
              strokeWidth="12"
              strokeDasharray="15 8 4 8 60 30"
              opacity="0.4"
            />
            <circle
              cx="250"
              cy="250"
              r="174"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.75"
              strokeDasharray="2 12"
              opacity="0.6"
            />
            <circle
              cx="250"
              cy="250"
              r="148"
              fill="none"
              stroke="#0055ff"
              strokeWidth="1"
              opacity="0.5"
            />
          </g>

          <g className="ring hud-layer-4">
            <circle
              cx="250"
              cy="250"
              r="110"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="1"
              strokeDasharray="40 10 2 10 2 10"
              opacity="0.8"
            />
            <circle
              cx="250"
              cy="250"
              r="118"
              fill="none"
              stroke="#0088ff"
              strokeWidth="2"
              strokeDasharray="130 130"
              opacity="0.6"
            />
            <path d="M 130 250 L 145 250" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
            <path d="M 370 250 L 355 250" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
            <path d="M 250 130 L 250 145" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
            <path d="M 250 370 L 250 355" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
          </g>

          <g className="ring hud-layer-3">
            <circle
              cx="250"
              cy="250"
              r="70"
              fill="none"
              stroke="#00aaff"
              strokeWidth="6"
              strokeDasharray="20 30 10 30"
              opacity="0.6"
            />
            <circle
              cx="250"
              cy="250"
              r="62"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity="0.5"
            />
            <circle
              cx="250"
              cy="250"
              r="82"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="0.5"
              opacity="0.4"
            />
          </g>

          <circle
            cx="250"
            cy="250"
            r="35"
            fill="none"
            stroke="#0088ff"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
          />
          <circle cx="250" cy="250" r="15" fill="var(--neon-cyan)" opacity="0.1" />
          <circle cx="250" cy="250" r="3" fill="#ffffff" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}
