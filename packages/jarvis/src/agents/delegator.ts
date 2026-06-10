import type { AuditEntry } from "@openhawkins/core";
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
  auditEntry: AuditEntry;
}
