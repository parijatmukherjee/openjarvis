import type {
  AgentRoute,
  AgentContext,
  AgentResult,
  AgentInfo,
  AgentSessionConfig,
} from "./types.js";
import { AgentSession } from "./session.js";

export interface AgentPool {
  list(): Promise<AgentInfo[]>;
  execute(route: AgentRoute, context: AgentContext): Promise<AgentResult>;
  health(agentId: string): Promise<boolean>;
}

export const MAX_CONCURRENT = 3;
export const MAX_SPAWN_DEPTH = 2;

interface AgentFactory {
  (context: AgentContext): Promise<unknown>;
}

export class InProcessAgentPool implements AgentPool {
  private agents: Map<string, AgentInfo>;
  private factories: Map<string, AgentFactory>;
  private sessions: Map<string, AgentSession>;

  constructor() {
    this.agents = new Map([
      [
        "research",
        {
          id: "research",
          name: "Research Agent",
          role: "research",
          capabilities: ["web_search", "summarize"],
          active: true,
        },
      ],
      [
        "system",
        {
          id: "system",
          name: "System Agent",
          role: "system",
          capabilities: ["open_app", "list_apps"],
          active: true,
        },
      ],
      [
        "weather",
        {
          id: "weather",
          name: "Weather Agent",
          role: "data",
          capabilities: ["weather:read"],
          active: true,
        },
      ],
      [
        "calendar",
        {
          id: "calendar",
          name: "Calendar Agent",
          role: "data",
          capabilities: ["calendar:read", "calendar:write"],
          active: true,
        },
      ],
      [
        "browser",
        {
          id: "browser",
          name: "Browser Agent",
          role: "browser",
          capabilities: ["web:browse"],
          active: true,
        },
      ],
      [
        "vision",
        {
          id: "vision",
          name: "Vision Agent",
          role: "vision",
          capabilities: ["detect_humans", "detect_emotion"],
          active: true,
        },
      ],
      [
        "discord",
        {
          id: "discord",
          name: "Discord Agent",
          role: "communication",
          capabilities: ["discord:message", "discord:read"],
          active: true,
        },
      ],
      [
        "telegram",
        {
          id: "telegram",
          name: "Telegram Agent",
          role: "communication",
          capabilities: ["telegram:message", "telegram:read"],
          active: true,
        },
      ],
      [
        "web",
        {
          id: "web",
          name: "Web Agent",
          role: "web",
          capabilities: ["web:fetch", "web:browse", "document:convert"],
          active: true,
        },
      ],
      [
        "email",
        {
          id: "email",
          name: "Email Agent",
          role: "communication",
          capabilities: ["email:read", "email:send"],
          active: true,
        },
      ],
      [
        "notion",
        {
          id: "notion",
          name: "Notion Agent",
          role: "data",
          capabilities: ["notion:read", "notion:write"],
          active: true,
        },
      ],
      [
        "general",
        {
          id: "general",
          name: "General Agent",
          role: "general",
          capabilities: ["model-call"],
          active: true,
        },
      ],
      [
        "cron",
        {
          id: "cron",
          name: "Cron Agent",
          role: "scheduling",
          capabilities: ["cron:manage", "cron:read"],
          active: true,
        },
      ],
      [
        "secrets",
        {
          id: "secrets",
          name: "Secrets Agent",
          role: "security",
          capabilities: ["secrets:read"],
          active: true,
        },
      ],
      [
        "slow",
        {
          id: "slow",
          name: "Slow Agent",
          role: "test",
          capabilities: [],
          active: true,
        },
      ],
    ]);

    this.factories = new Map<string, AgentFactory>([
      ["research", async () => ({ results: ["Result 1", "Result 2"] })],
      ["system", async () => ({ opened: true })],
      ["weather", async () => ({ temp: 72, condition: "sunny" })],
      ["calendar", async () => ({ events: [{ title: "Meeting", time: "10:00" }] })],
      ["browser", async () => ({ loaded: true })],
      ["vision", async () => ({ humans: 1, emotion: "neutral" })],
      ["discord", async () => ({ messageId: "mock-msg-123" })],
      ["telegram", async () => ({ messageId: 42 })],
      ["web", async () => ({ markdown: "Fetched content", url: "https://example.com" })],
      ["email", async () => ({ messageId: "mock-email-123" })],
      ["notion", async () => ({ pages: [] })],
      ["cron", async () => ({ scheduled: true, jobId: "mock-cron-123" })],
      ["secrets", async () => ({ secretKey: "mock-secret", stored: true })],
      ["general", async () => ({ response: "general-acknowledgment" })],
      [
        "slow",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { slow: true };
        },
      ],
    ]);

    this.sessions = new Map();
  }

  async list(): Promise<AgentInfo[]> {
    return Array.from(this.agents.values());
  }

  async execute(route: AgentRoute, context: AgentContext): Promise<AgentResult> {
    const factory = this.factories.get(route.agentId);
    if (!factory) {
      return { agentId: route.agentId, success: false, error: `Unknown agent: ${route.agentId}` };
    }

    const start = Date.now();
    const timeoutMs = route.timeoutMs ?? 30000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        factory(context),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      return { agentId: route.agentId, success: true, output, durationMs: Date.now() - start };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { agentId: route.agentId, success: false, error, durationMs: Date.now() - start };
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  async health(agentId: string): Promise<boolean> {
    return this.agents.has(agentId) && this.agents.get(agentId)!.active;
  }

  createSession(parentAgentId: string, mode: "fork" | "isolated"): AgentSession {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const config: AgentSessionConfig = {
      id,
      parentAgentId,
      mode,
      maxDepth: MAX_SPAWN_DEPTH,
      timeoutMs: 30000,
    };
    const session = new AgentSession(config, this);
    this.sessions.set(id, session);
    return session;
  }
}
