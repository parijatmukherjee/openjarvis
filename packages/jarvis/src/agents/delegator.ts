import type { Intent } from "../intent.js";
import type { JarvisContext } from "../context.js";

export interface Delegator {
  delegate(intent: Intent, context: JarvisContext): Promise<DelegatorResult[]>;
}

export interface DelegatorResult {
  agentId: string;
  agentName: string;
  output: unknown;
  success: boolean;
  error?: string;
  auditEntry: { kind: string; at: number; data: Record<string, unknown> };
}
