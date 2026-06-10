import type { ChildProcess } from "node:child_process";
import type { AgentGrant } from "@openjarvis/core";

export interface AgentPool {
  getAvailableAgents(): Promise<AgentInfo[]>;
  spawn(agentId: string, config: AgentConfig): Promise<AgentHandle>;
  kill(handle: AgentHandle): Promise<void>;
}

export interface AgentHandle {
  id: string;
  process: ChildProcess;
  grant: AgentGrant;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
}

export interface AgentConfig {
  params?: Record<string, unknown>;
}
