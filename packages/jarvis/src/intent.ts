import type { JarvisContext } from "./context.js";

export interface Intent {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  ambiguous: boolean;
  suggestedClarification?: string;
}

export interface IntentParser {
  parse(input: string, context: JarvisContext): Promise<Intent>;
}
