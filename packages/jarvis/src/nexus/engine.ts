import type { EventBus } from "../event-bus.js";
import type { Intent, JarvisContext, Synthesis, AgentResult, AgentRoute } from "./types.js";
import type { IntentRouter } from "./router.js";
import type { AgentPool } from "./pool.js";
import type { Synthesizer } from "./synthesizer.js";

export interface NexusConfig {
  intentRouter: IntentRouter;
  agentPool: AgentPool;
  synthesizer: Synthesizer;
  eventBus: EventBus;
  auditLog?: unknown;
  memoryStore?: unknown;
  maxConcurrentAgents: number;
  defaultTimeoutMs: number;
}

export class NexusEngine {
  constructor(private cfg: NexusConfig) {}

  async execute(intent: Intent, context: JarvisContext): Promise<Synthesis> {
    const sessionId = context.sessionId;

    // 1. Route intent to agents
    const plan = this.cfg.intentRouter.route(intent, context);
    await this.emit({ type: "intent_routed", intent, plan, sessionId, at: Date.now() });

    // 2. Dispatch agents
    const results: AgentResult[] = [];
    const failed: string[] = [];

    // Parallel dispatch
    if (plan.parallel.length > 0) {
      const parallelResults = await Promise.all(
        plan.parallel.map((route) => this.dispatchAgent(route, context)),
      );
      for (const result of parallelResults) {
        results.push(result);
        if (!result.success) failed.push(result.agentId);
      }
    }

    // Sequential dispatch
    for (const route of plan.sequential) {
      const result = await this.dispatchAgent(route, context);
      results.push(result);
      if (!result.success) failed.push(result.agentId);
      if (result.success && results.length > 0) {
        route.input = result.output;
      }
    }

    // Primary agent
    if (plan.primary) {
      const result = await this.dispatchAgent(plan.primary, context);
      results.push(result);
      if (!result.success) failed.push(result.agentId);
    }

    await this.emit({ type: "results_collected", results, failed, sessionId, at: Date.now() });

    // 3. Synthesize results
    const synthesis = await this.cfg.synthesizer.synthesize(results, intent, context);
    await this.emit({ type: "synthesis_complete", synthesis, sessionId, at: Date.now() });

    return synthesis;
  }

  private async dispatchAgent(route: AgentRoute, context: JarvisContext): Promise<AgentResult> {
    const sessionId = context.sessionId;
    const taskId = `${sessionId}-${route.agentId}-${Date.now()}`;

    await this.emit({
      type: "task_started",
      taskId,
      agentId: route.agentId,
      description: `Dispatch ${route.agentId}`,
      sessionId,
      at: Date.now(),
    });

    await this.emit({
      type: "agent_dispatched",
      agentId: route.agentId,
      route,
      sessionId,
      at: Date.now(),
    });

    const agentContext = {
      sessionId,
      intent: context.recentIntents[context.recentIntents.length - 1] ?? {
        action: "unknown",
        params: {},
        confidence: 0,
        ambiguous: true,
      },
      memory: undefined,
    };

    const result = await this.cfg.agentPool.execute(route, agentContext);

    if (result.success) {
      await this.emit({
        type: "agent_completed",
        agentId: route.agentId,
        result,
        durationMs: result.durationMs ?? 0,
        sessionId,
        at: Date.now(),
      });
    } else if (result.error?.includes("timeout")) {
      await this.emit({
        type: "agent_timeout",
        agentId: route.agentId,
        timeoutMs: route.timeoutMs ?? this.cfg.defaultTimeoutMs,
        sessionId,
        at: Date.now(),
      });
    } else {
      await this.emit({
        type: "agent_failed",
        agentId: route.agentId,
        error: result.error ?? "Unknown error",
        sessionId,
        at: Date.now(),
      });
    }

    await this.emit({
      type: "task_completed",
      taskId,
      agentId: route.agentId,
      success: result.success,
      sessionId,
      at: Date.now(),
    });

    return result;
  }

  private async emit(event: { type: string; [key: string]: unknown }): Promise<void> {
    await this.cfg.eventBus.publish({
      topic: "nexus",
      payload: event,
      timestamp: Date.now(),
      source: "nexus",
    });
  }
}
