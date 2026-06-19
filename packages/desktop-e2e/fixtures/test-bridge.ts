import type {
  NexusBridge,
  Task,
  AgentView,
  MessageView,
} from "./test-data.js";
import {
  createTask,
  createAgent,
  createMessage,
  sampleTasks,
  sampleAgents,
  sampleMessages,
} from "./test-data.js";

type EventHandler = (event: unknown) => void;

export class PlaywrightTestBridge implements NexusBridge {
  private tasks: Task[] = [...sampleTasks];
  private agents: AgentView[] = [...sampleAgents];
  private messages: MessageView[] = [...sampleMessages];
  private eventHandlers: Set<EventHandler> = new Set();
  private intentLog: Array<{ action: string; params: Record<string, unknown> }> = [];

  async getTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async getAgents(): Promise<AgentView[]> {
    return [...this.agents];
  }

  async getMessages(): Promise<MessageView[]> {
    return [...this.messages];
  }

  async executeIntent(action: string, params: Record<string, unknown>): Promise<void> {
    this.intentLog.push({ action, params });
  }

  subscribeToEvents(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  addTask(task: Partial<Task> = {}): Task {
    const t = createTask(task);
    this.tasks.push(t);
    this.emit({ type: "task:created", task: t });
    return t;
  }

  updateTask(id: string, updates: Partial<Task>): void {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.tasks[idx] = { ...this.tasks[idx], ...updates };
      this.emit({ type: "task:updated", task: this.tasks[idx] });
    }
  }

  addAgent(agent: Partial<AgentView> = {}): AgentView {
    const a = createAgent(agent);
    this.agents.push(a);
    this.emit({ type: "agent:updated", agent: a });
    return a;
  }

  addMessage(message: Partial<MessageView> = {}): MessageView {
    const m = createMessage(message);
    this.messages.push(m);
    this.emit({ type: "message:created", message: m });
    return m;
  }

  simulateIntentResponse(action: string, result: unknown): void {
    this.emit({ type: "intent:completed", action, result });
  }

  simulateError(error: string): void {
    this.emit({ type: "error", error });
  }

  getIntentLog(): Array<{ action: string; params: Record<string, unknown> }> {
    return [...this.intentLog];
  }

  reset(): void {
    this.tasks = [...sampleTasks];
    this.agents = [...sampleAgents];
    this.messages = [...sampleMessages];
    this.eventHandlers.clear();
    this.intentLog = [];
  }

  private emit(event: unknown): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}