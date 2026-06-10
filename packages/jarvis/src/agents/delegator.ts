import type { Intent } from "../intent.js";
import type { JarvisContext } from "../context.js";

export interface Delegator {
  delegate(intent: Intent, context: JarvisContext): Promise<AgentResult[]>;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  output: unknown;
  success: boolean;
  error?: string;
  /** Audit snapshot — may be a full AuditEntry or a lightweight record. */
  auditEntry: { kind: string; at: number; data: Record<string, unknown> };
}
