import type { IntentParser, Intent } from "../intent.js";
import type { JarvisContext } from "../context.js";

/**
 * A lightweight rule-based intent parser for v1.
 *
 * Matches common patterns:
 *   - "open X" → action: "open_app"
 *   - "search for Y" / "find Y" → action: "search"
 *   - "what's on my calendar" / "show calendar" → action: "get_calendar"
 *   - "remind me to Z" → action: "set_reminder"
 *   - "what do you see" / "look" → action: "vision_query"
 *
 * Falls back to "unknown" with `ambiguous: true` and a clarification prompt.
 *
 * v1.1: Replace with a local model (Ollama/llama3.1) with structured output.
 */
export class RuleBasedIntentParser implements IntentParser {
  async parse(input: string, _context: JarvisContext): Promise<Intent> {
    const normalized = input.toLowerCase().trim();

    // Open app
    const openMatch = normalized.match(/^open\s+(.+)$/);
    if (openMatch) {
      return {
        action: "open_app",
        params: { app: openMatch[1]!.trim() },
        confidence: 0.9,
        ambiguous: false,
      };
    }

    // Search
    const searchMatch = normalized.match(/^(?:search\s+for|search|find)\s+(.+)$/);
    if (searchMatch) {
      return {
        action: "search",
        params: { query: searchMatch[1]!.trim() },
        confidence: 0.85,
        ambiguous: false,
      };
    }

    // Calendar
    if (/calendar|schedule|agenda|what.*on.*today/.test(normalized)) {
      return {
        action: "get_calendar",
        params: {},
        confidence: 0.8,
        ambiguous: false,
      };
    }

    // Reminder
    const remindMatch = normalized.match(/^remind\s+me\s+(?:to\s+)?(.+)$/);
    if (remindMatch) {
      return {
        action: "set_reminder",
        params: { text: remindMatch[1]!.trim() },
        confidence: 0.85,
        ambiguous: false,
      };
    }

    // Vision query
    if (/what\s+do\s+you\s+see|look|show\s+me|camera|vision/.test(normalized)) {
      return {
        action: "vision_query",
        params: {},
        confidence: 0.8,
        ambiguous: false,
      };
    }

    // Unknown / ambiguous
    return {
      action: "unknown",
      params: { text: input },
      confidence: 0.3,
      ambiguous: true,
      suggestedClarification: "I'm not sure what you mean. Could you rephrase that?",
    };
  }
}
