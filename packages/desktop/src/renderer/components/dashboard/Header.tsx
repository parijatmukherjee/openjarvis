import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSettingsContext } from "../../context/SettingsContext";
import { useNexus } from "../../contexts/NexusContext";

export function Header() {
  const greeting = getGreeting();
  const { profile } = useSettingsContext();
  const userName = profile.userName;
  const nexus = useNexus();
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    nexus.getAgents().then((agents) => {
      setAgentCount(agents.length);
    }).catch(() => {
      setAgentCount(0);
    });
  }, [nexus]);

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <h1 className="text-2xl font-light tracking-tight">
          {greeting}, <span className="text-neon-cyan">{userName}</span>
        </h1>
        <p className="text-sm text-text-secondary mt-1">All systems operational. {agentCount} agents ready.</p>
      </motion.div>

      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="text-right">
          <div className="text-sm font-mono text-neon-cyan">{new Date().toLocaleTimeString()}</div>
          <div className="text-xs text-text-secondary">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      </motion.div>
    </header>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
