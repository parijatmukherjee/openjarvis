import type { Intent } from "./intent.js";
import type { JarvisContext } from "./context.js";
import type { AgentResult } from "./agents/delegator.js";

export interface Synthesizer {
  synthesize(
    results: AgentResult[],
    originalIntent: Intent,
    context: JarvisContext,
  ): Promise<Synthesis>;
}

export interface Synthesis {
  spoken: string;
  visual?: VisualCommand[];
  action?: string;
}

export type VisualCommand =
  | { type: "open_app"; app: string; monitor?: number }
  | { type: "open_url"; url: string; monitor?: number }
  | { type: "show_text"; text: string; monitor?: number }
  | { type: "highlight"; element: string; monitor?: number }
  | { type: "clear"; monitor?: number };
