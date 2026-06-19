import type { Intent } from "./intent.js";
import type { JarvisContext } from "./context.js";
import type { DelegatorResult } from "./agents/delegator.js";
import type { VisualCommand } from "./synthesis.js";

export interface VisualResolver {
  resolve(intent: Intent, agentResults: DelegatorResult[], context: JarvisContext): VisualCommand[];
}

export interface VisualResolverConfig {
  mappings: Record<string, VisualCommand>;
  defaultMonitor: number;
  enabled: boolean;
}
