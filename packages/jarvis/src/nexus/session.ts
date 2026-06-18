import type { AgentSessionConfig, AgentResult, AgentRoute, AgentContext } from "./types.js";
import type { AgentPool } from "./pool.js";

export class AgentSession {
  private _id: string;
  private parentAgentId: string;
  private mode: "fork" | "isolated";
  private depth: number;
  private maxDepth: number;
  private timeoutMs: number;
  private cancelled: boolean;
  private pool: AgentPool;
  private yieldedMessages: string[];

  constructor(config: AgentSessionConfig, pool: AgentPool) {
    this._id = config.id;
    this.parentAgentId = config.parentAgentId;
    this.mode = config.mode;
    this.depth = 0;
    this.maxDepth = config.maxDepth;
    this.timeoutMs = config.timeoutMs;
    this.cancelled = false;
    this.pool = pool;
    this.yieldedMessages = [];
  }

  async spawn(agentId: string, message: string): Promise<AgentResult> {
    if (this.cancelled) {
      return { agentId, success: false, error: "Session cancelled", durationMs: 0 };
    }
    if (this.currentDepth >= this.maxDepth) {
      return {
        agentId,
        success: false,
        error: `Maximum depth ${this.maxDepth} exceeded`,
        durationMs: 0,
      };
    }
    this.depth++;

    const sessionId = this.mode === "fork" ? `${this.parentAgentId}-${agentId}` : agentId;

    const route: AgentRoute = {
      agentId,
      confidence: 1,
      required: true,
      timeoutMs: this.timeoutMs,
    };

    const context: AgentContext = {
      sessionId,
      intent: { action: message, params: {}, confidence: 1, ambiguous: false },
    };

    const start = Date.now();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Session timeout exceeded")), this.timeoutMs),
      );
      return await Promise.race([this.pool.execute(route, context), timeoutPromise]);
    } catch (err) {
      return {
        agentId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  async yield(message: string): Promise<void> {
    this.yieldedMessages.push(message);
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  get currentDepth(): number {
    return this.depth;
  }

  get id(): string {
    return this._id;
  }

  getYieldedMessages(): string[] {
    return [...this.yieldedMessages];
  }
}
