import type {
  AgentResult,
  Intent,
  JarvisContext,
  Synthesis,
  SynthesizeHooks,
  Synthesizer,
} from "./types.js";
import type { ModelClient } from "../model/types.js";
import { ModelError } from "../model/error.js";

export type { Synthesizer };

export class RuleBasedSynthesizer implements Synthesizer {
  private client: ModelClient | undefined;

  constructor(client?: ModelClient) {
    this.client = client;
  }

  async synthesize(
    results: AgentResult[],
    _originalIntent: Intent,
    _context: JarvisContext,
    hooks?: SynthesizeHooks,
  ): Promise<Synthesis> {
    if (this.client && hooks?.onChunk) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const resultsPrompt = results
            .map(
              (r) => `${r.agentId}: ${r.success ? JSON.stringify(r.output) : `error: ${r.error}`}`,
            )
            .join("\n");
          let assembled = "";
          for await (const chunk of this.client.chatStream(
            resultsPrompt,
            "You are JARVIS, a helpful AI assistant. Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
            hooks.abort,
          )) {
            if (chunk.error) {
              hooks.onChunk({ text: chunk.content, done: true, error: chunk.error });
              throw new ModelError(chunk.error, chunk.content);
            }
            assembled += chunk.content;
            hooks.onChunk({ text: chunk.content, done: false });
          }
          return { spoken: assembled };
        }
      } catch {
        // Fall back to rule-based synthesis
      }
    }

    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const resultsPrompt = results
            .map(
              (r) => `${r.agentId}: ${r.success ? JSON.stringify(r.output) : `error: ${r.error}`}`,
            )
            .join("\n");
          const response = await this.client.chat(
            resultsPrompt,
            "You are JARVIS, a helpful AI assistant. Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
          );
          return { spoken: response.content };
        }
      } catch {
        // Fall back to rule-based synthesis
      }
    }

    const parts: string[] = [];
    const visual: Synthesis["visual"] = [];

    for (const result of results) {
      if (!result.success) {
        parts.push(`${result.agentId} is unavailable: ${result.error}`);
        continue;
      }

      switch (result.agentId) {
        case "weather": {
          const output = result.output as { temp?: number; condition?: string; status?: string };
          if (output.temp !== undefined && output.condition !== undefined) {
            parts.push(`It's ${output.condition} and ${output.temp} degrees.`);
            if (output.temp !== undefined) {
              visual.push({ type: "show_text", text: `${output.temp}°F`, monitor: 1 });
            }
          } else {
            parts.push(`Weather agent dispatched.`);
          }
          break;
        }
        case "calendar": {
          const output = result.output as {
            events?: Array<{ title: string; time: string }>;
            status?: string;
          };
          if (output.events?.length) {
            const eventList = output.events.map((e) => `${e.title} at ${e.time}`).join(", ");
            parts.push(`You have ${eventList}.`);
            visual.push({ type: "open_app", app: "Calendar", monitor: 1 });
          } else {
            parts.push("You have no events.");
          }
          break;
        }
        case "system": {
          const output = result.output as { opened?: boolean; status?: string };
          if (output.opened) {
            parts.push("Done.");
          } else {
            parts.push("System command dispatched.");
          }
          break;
        }
        case "research": {
          const output = result.output as { results?: string[]; status?: string };
          if (output.results?.length) {
            parts.push(`I found: ${output.results.join(", ")}.`);
          } else {
            parts.push("Research dispatched.");
          }
          break;
        }
        case "browser": {
          const output = result.output as { loaded?: boolean; status?: string };
          if (output.loaded) {
            parts.push("Opened the browser.");
            visual.push({ type: "open_app", app: "Browser", monitor: 2 });
          } else {
            parts.push("Browser command dispatched.");
          }
          break;
        }
        case "vision": {
          const output = result.output as { humans?: number; emotion?: string; status?: string };
          if (output.humans !== undefined) {
            parts.push(`I see ${output.humans} person${output.humans !== 1 ? "s" : ""}.`);
            if (output.emotion) {
              parts.push(`They seem ${output.emotion}.`);
            }
          } else {
            parts.push("Vision analysis dispatched.");
          }
          break;
        }
        default:
          parts.push(`${result.agentId} dispatched.`);
      }
    }

    return {
      spoken: parts.join(" ") || "I'm not sure how to help with that.",
      visual: visual.length > 0 ? visual : undefined,
    };
  }
}
