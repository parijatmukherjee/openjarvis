import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNexus } from "../../contexts/NexusContext";

interface AgentBlip {
  id: string;
  name: string;
  status: "active" | "busy" | "failed" | "idle";
  angle: number;
  distance: number;
}

const statusColors = {
  active: "var(--status-success)",
  busy: "var(--status-warning)",
  failed: "var(--status-error)",
  idle: "var(--status-idle)",
};

function distributeAgents(agentCount: number): Array<{ angle: number; distance: number }> {
  const positions: Array<{ angle: number; distance: number }> = [];
  for (let i = 0; i < agentCount; i++) {
    const angle = (360 / agentCount) * i + 15;
    const distance = 0.3 + (i % 3) * 0.2;
    positions.push({ angle, distance });
  }
  return positions;
}

export function AgentRadar() {
  const nexus = useNexus();
  const [agents, setAgents] = useState<AgentBlip[]>([]);

  useEffect(() => {
    nexus.getAgents().then((agentViews) => {
      const positions = distributeAgents(agentViews.length);
      setAgents(
        agentViews.map((a, i) => ({
          id: a.id,
          name: a.name,
          status: a.status,
          angle: positions[i]?.angle ?? 0,
          distance: positions[i]?.distance ?? 0.5,
        })),
      );
    });
  }, [nexus]);

  return (
    <div className="relative w-64 h-64">
      {/* Radar rings */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <div
          key={scale}
          className="absolute rounded-full border border-neon-cyan/10"
          style={{
            width: `${scale * 100}%`,
            height: `${scale * 100}%`,
            top: `${(1 - scale) * 50}%`,
            left: `${(1 - scale) * 50}%`,
          }}
        />
      ))}

      {/* Crosshairs */}
      <div className="absolute top-0 left-1/2 w-px h-full bg-neon-cyan/5" />
      <div className="absolute top-1/2 left-0 w-full h-px bg-neon-cyan/5" />

      {/* Sweeping radar line */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-1/2 h-px origin-left"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,212,255,0.4) 0%, transparent 100%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      {/* Agent blips */}
      {agents.map((agent) => {
        const x = 50 + Math.cos((agent.angle * Math.PI) / 180) * agent.distance * 50;
        const y = 50 + Math.sin((agent.angle * Math.PI) / 180) * agent.distance * 50;

        return (
          <motion.div
            key={agent.id}
            className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${x}%`, top: `${y}%` }}
            whileHover={{ scale: 1.5 }}
            animate={{
              boxShadow: [
                `0 0 8px ${statusColors[agent.status]}`,
                `0 0 16px ${statusColors[agent.status]}`,
                `0 0 8px ${statusColors[agent.status]}`,
              ],
            }}
            transition={{
              boxShadow: { duration: 2, repeat: Infinity },
              scale: { duration: 0.2 },
            }}
          >
            <div
              className="w-full h-full rounded-full"
              style={{ backgroundColor: statusColors[agent.status] }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-bg-panel border border-neon-cyan/20 rounded text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
              {agent.name}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
