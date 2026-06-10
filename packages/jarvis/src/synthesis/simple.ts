import type { Synthesizer, Synthesis } from "../synthesis.js";
import type { Intent } from "../intent.js";
import type { JarvisContext } from "../context.js";
import type { AgentResult } from "../agents/delegator.js";

/**
 * Simple rule-based synthesizer for v1.
 *
 * Generates spoken response from agent results and visual commands from
 * the original intent. No model call — deterministic, fast, testable.
 *
 * v1.1: Replace with an Ollama-based synthesis model.
 */
export class SimpleSynthesizer implements Synthesizer {
  async synthesize(
    results: AgentResult[],
    originalIntent: Intent,
    _context: JarvisContext,
  ): Promise<Synthesis> {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    let spoken = "";

    if (successful.length === 0 && failed.length > 0) {
      spoken = `I wasn't able to complete that. ${failed[0]!.error || ""}`;
    } else if (successful.length === 1) {
      spoken = `Done. ${successful[0]!.agentName} completed the task.`;
    } else if (successful.length > 1) {
      spoken = `Done. I've completed ${successful.length} tasks for you.`;
    } else {
      spoken = "I'm on it.";
    }

    const visual = this.buildVisualCommands(originalIntent);

    return { spoken, visual };
  }

  private buildVisualCommands(intent: Intent): import("../synthesis.js").VisualCommand[] {
    const visual: import("../synthesis.js").VisualCommand[] = [];

    if (intent.action === "open_app" && typeof intent.params.app === "string") {
      visual.push({ type: "open_app", app: intent.params.app });
    }

    if (intent.action === "search" && typeof intent.params.query === "string") {
      visual.push({
        type: "open_url",
        url: `https://www.google.com/search?q=${encodeURIComponent(intent.params.query)}`,
      });
    }

    if (intent.action === "get_calendar") {
      visual.push({ type: "open_app", app: "calendar" });
    }

    if (intent.action === "vision_query") {
      visual.push({ type: "open_vision_feed" });
    }

    return visual;
  }
}
