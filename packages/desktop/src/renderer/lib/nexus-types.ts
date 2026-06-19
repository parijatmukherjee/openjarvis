// Local type definitions mirroring @openjarvis/jarvis/nexus types.
// Kept local to avoid deep-import resolution issues with tsc -b in Docker.

import type { CapabilityName } from "@openjarvis/core";

export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface AgentView {
  id: string;
  name: string;
  role: string;
  status: "active" | "busy" | "failed" | "idle";
  description: string;
  capabilities: CapabilityName[];
  lastActivity: string;
  tasksCompleted: number;
}

export interface MessageView {
  id: string;
  type: "user" | "jarvis" | "system";
  text: string;
  timestamp: string;
}

export interface NexusBridge {
  getTasks(): Promise<Task[]>;
  getAgents(): Promise<AgentView[]>;
  getMessages(): Promise<MessageView[]>;
  executeIntent(action: string, params: Record<string, unknown>): Promise<void>;
  subscribeToEvents(handler: (event: unknown) => void): () => void;
  subscribeToMessages(handler: () => void): () => void;
}
