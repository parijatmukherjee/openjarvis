import type { Intent } from "./intent.js";
import type { JarvisContext } from "./context.js";
import type { AgentResult } from "./agents/delegator.js";
import type { VisualCommand } from "./synthesis.js";

export interface VisualResolver {
  resolve(intent: Intent, agentResults: AgentResult[], context: JarvisContext): VisualCommand[];
}

export interface VisualResolverConfig {
  mappings: Record<string, VisualCommand>;
  defaultMonitor: number;
  enabled: boolean;
}
