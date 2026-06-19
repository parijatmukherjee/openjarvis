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
}

let nextId = 1;
function uid(): string {
  return String(nextId++);
}

export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: uid(),
    agentId: "research",
    description: "Test task",
    status: "pending",
    startedAt: Date.now(),
    ...overrides,
  };
}

export function createAgent(overrides: Partial<AgentView> = {}): AgentView {
  return {
    id: uid(),
    name: "TestAgent",
    role: "Test",
    status: "active",
    description: "A test agent",
    capabilities: ["web_search"] as CapabilityName[],
    lastActivity: "now",
    tasksCompleted: 0,
    ...overrides,
  };
}

export function createMessage(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: uid(),
    type: "user",
    text: "Hello",
    timestamp: new Date().toLocaleTimeString(),
    ...overrides,
  };
}

export const sampleAgents: AgentView[] = [
  createAgent({
    id: "research",
    name: "Research",
    role: "Research",
    status: "active",
    description: "Web search and information gathering",
    capabilities: ["web_search", "summarize"] as CapabilityName[],
    lastActivity: "2m ago",
    tasksCompleted: 142,
  }),
  createAgent({
    id: "system",
    name: "System",
    role: "System",
    status: "busy",
    description: "System operations and file management",
    capabilities: ["shell", "fs:read", "fs:write"] as CapabilityName[],
    lastActivity: "now",
    tasksCompleted: 89,
  }),
  createAgent({
    id: "weather",
    name: "Weather",
    role: "Data",
    status: "active",
    description: "Weather data retrieval and forecasts",
    capabilities: ["weather:read"] as CapabilityName[],
    lastActivity: "5m ago",
    tasksCompleted: 256,
  }),
];

export const sampleTasks: Task[] = [
  createTask({
    id: "1",
    agentId: "weather",
    description: "Fetching weather data",
    status: "running",
    startedAt: Date.now() - 1200,
    durationMs: 1200,
  }),
  createTask({
    id: "2",
    agentId: "calendar",
    description: "Loading calendar events",
    status: "completed",
    startedAt: Date.now() - 800,
    durationMs: 800,
  }),
  createTask({
    id: "3",
    agentId: "research",
    description: "Web search: AI trends 2025",
    status: "pending",
    startedAt: Date.now(),
  }),
];

export const sampleMessages: MessageView[] = [
  createMessage({
    id: "1",
    type: "user",
    text: "What's the weather like?",
    timestamp: "10:23 AM",
  }),
  createMessage({
    id: "2",
    type: "jarvis",
    text: "It's 72°F and sunny.",
    timestamp: "10:23 AM",
  }),
  createMessage({
    id: "3",
    type: "system",
    text: "Agent 'weather' dispatched",
    timestamp: "10:23 AM",
  }),
];
