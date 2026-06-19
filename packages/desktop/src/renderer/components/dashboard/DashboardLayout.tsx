import { useState, useEffect } from "react";
import { useNexus } from "../../contexts/NexusContext";
import { HudCore } from "../ui/HudCore";
import { Chatbox } from "../ui/Chatbox";
import { VoiceConversation } from "../ui/VoiceConversation";
import type { AgentView, Task } from "../../lib/nexus-types";

interface DashboardLayoutProps {
  onSettings?: (() => void) | undefined;
}

export function DashboardLayout({ onSettings }: DashboardLayoutProps) {
  return (
    <div className="hud-dashboard">
      <LeftPanel onSettings={onSettings} />
      <CenterPanel />
      <RightPanel />
    </div>
  );
}

function LeftPanel({ onSettings }: { onSettings?: (() => void) | undefined }) {
  const nexus = useNexus();
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  useEffect(() => {
    nexus.getAgents().then(setAgents);
  }, [nexus]);

  const statusCounts = agents.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="hud-panel hud-left-panel">
      <button
        data-testid="btn-workboard"
        className={`hud-btn ${activePanel === "workboard" ? "hud-btn--active" : ""}`}
        onClick={() => setActivePanel(activePanel === "workboard" ? null : "workboard")}
      >
        Workboard
      </button>
      <button
        data-testid="btn-agents"
        className={`hud-btn ${activePanel === "agents" ? "hud-btn--active" : ""}`}
        onClick={() => setActivePanel(activePanel === "agents" ? null : "agents")}
      >
        Agents
      </button>
      <button
        data-testid="btn-voice"
        className={`hud-btn ${activePanel === "voice" ? "hud-btn--active" : ""}`}
        onClick={() => setActivePanel(activePanel === "voice" ? null : "voice")}
      >
        Voice
      </button>
      <button
        data-testid="btn-settings"
        className={`hud-btn ${activePanel === "settings" ? "hud-btn--active" : ""}`}
        onClick={() => {
          setActivePanel(activePanel === "settings" ? null : "settings");
          onSettings?.();
        }}
      >
        Settings
      </button>

      {activePanel === "voice" && (
        <div className="hud-sub-panel" style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <VoiceConversation />
        </div>
      )}

      {activePanel === "agents" && (
        <div className="hud-sub-panel">
          <div className="hud-sub-header">AGENT_STATUS // {agents.length} ONLINE</div>
          {agents.map((agent) => (
            <div key={agent.id} className="hud-agent-row">
              <span className={`hud-status-dot hud-status-dot--${agent.status}`} />
              <span className="hud-agent-name">{agent.name}</span>
              <span className="hud-agent-tasks">{agent.tasksCompleted}</span>
            </div>
          ))}
        </div>
      )}

      {activePanel === "workboard" && <TaskPanel />}

      <div className="hud-status-bar">
        <div className="hud-status-row">
          <span className="hud-status-label">ACTIVE</span>
          <span className="hud-status-value">{statusCounts.active ?? 0}</span>
        </div>
        <div className="hud-status-row">
          <span className="hud-status-label">BUSY</span>
          <span className="hud-status-value">{statusCounts.busy ?? 0}</span>
        </div>
        <div className="hud-status-row">
          <span className="hud-status-label">IDLE</span>
          <span className="hud-status-value">{statusCounts.idle ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

function TaskPanel() {
  const nexus = useNexus();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    nexus.getTasks().then(setTasks);
  }, [nexus]);

  return (
    <div className="hud-sub-panel">
      <div className="hud-sub-header">TASK_BOARD // ACTIVE</div>
      {tasks.map((task) => (
        <div key={task.id} className="hud-task-row">
          <span className={`hud-task-dot hud-task-dot--${task.status}`} />
          <span className="hud-task-desc">{task.description}</span>
        </div>
      ))}
    </div>
  );
}

function CenterPanel() {
  return (
    <div className="hud-center">
      <HudCore />
    </div>
  );
}

function RightPanel() {
  return (
    <div className="hud-panel hud-right-panel">
      <Chatbox />
    </div>
  );
}
