import type { Intent, JarvisContext, DispatchPlan } from "./types.js";
import type { ModelClient } from "../model/types.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface IntentRouter {
  route(intent: Intent, context: JarvisContext): Promise<DispatchPlan>;
}

export class RuleBasedRouter implements IntentRouter {
  private rules: Map<string, (intent: Intent) => DispatchPlan>;
  private client: ModelClient | undefined;

  constructor(client?: ModelClient) {
    this.client = client;
    this.rules = new Map<string, (intent: Intent) => DispatchPlan>([
      ["search", this.routeToResearch.bind(this)],
      ["get_updates", this.routeToParallel.bind(this)],
      ["open_app", this.routeToSystem.bind(this)],
      ["check_weather", this.routeToWeather.bind(this)],
      ["check_calendar", this.routeToCalendar.bind(this)],
      ["browse", this.routeToBrowser.bind(this)],
      ["vision_query", this.routeToVision.bind(this)],
      ["send_discord", this.routeToDiscord.bind(this)],
      ["read_discord", this.routeToDiscord.bind(this)],
      ["send_telegram", this.routeToTelegram.bind(this)],
      ["read_telegram", this.routeToTelegram.bind(this)],
      ["fetch_url", this.routeToWeb.bind(this)],
      ["search_email", this.routeToEmail.bind(this)],
      ["read_email", this.routeToEmail.bind(this)],
      ["draft_email", this.routeToEmail.bind(this)],
      ["send_email", this.routeToEmail.bind(this)],
      ["calendar_list", this.routeToCalendar.bind(this)],
      ["calendar_get_events", this.routeToCalendar.bind(this)],
      ["calendar_create", this.routeToCalendar.bind(this)],
      ["calendar_update", this.routeToCalendar.bind(this)],
      ["calendar_delete", this.routeToCalendar.bind(this)],
      ["query_notion", this.routeToNotion.bind(this)],
      ["get_notion", this.routeToNotion.bind(this)],
      ["create_notion", this.routeToNotion.bind(this)],
      ["update_notion", this.routeToNotion.bind(this)],
      ["cron_schedule", this.routeToCron.bind(this)],
      ["cron_list", this.routeToCron.bind(this)],
      ["cron_cancel", this.routeToCron.bind(this)],
      ["secret_get", this.routeToSecrets.bind(this)],
      ["search_discord", this.routeToDiscord.bind(this)],
      ["get_calendar", this.routeToCalendar.bind(this)],
      ["set_reminder", this.routeToCron.bind(this)],
    ]);
  }

  async route(intent: Intent, context: JarvisContext): Promise<DispatchPlan> {
    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const validActions = Array.from(this.rules.keys()).join(", ");
          const response = await this.client.chat(
            `Classify: "${intent.action}". Valid actions: ${validActions}`,
            buildSystemPrompt("router", context),
          );
          const parsed = JSON.parse(response.content) as { action: string; confidence: number };
          if (
            typeof parsed.confidence === "number" &&
            parsed.confidence >= 0.7 &&
            typeof parsed.action === "string" &&
            this.rules.has(parsed.action)
          ) {
            const handler = this.rules.get(parsed.action)!;
            return handler(intent);
          }
        }
      } catch {
        // Fall back to rule-based routing
      }
    }
    const handler = this.rules.get(intent.action);
    if (handler) {
      return handler(intent);
    }
    return this.routeToGeneral(intent);
  }

  private routeToGeneral(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "general", confidence: intent.confidence, required: false },
    };
  }

  private routeToResearch(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "research", confidence: intent.confidence, required: true },
    };
  }

  private routeToSystem(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "system", confidence: intent.confidence, required: true },
    };
  }

  private routeToWeather(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "weather", confidence: intent.confidence, required: false },
    };
  }

  private routeToCalendar(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "calendar", confidence: intent.confidence, required: false },
    };
  }

  private routeToBrowser(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "browser", confidence: intent.confidence, required: true },
    };
  }

  private routeToVision(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "vision", confidence: intent.confidence, required: false },
    };
  }

  private routeToParallel(_intent: Intent): DispatchPlan {
    return {
      parallel: [
        { agentId: "weather", confidence: 0.9, required: false },
        { agentId: "calendar", confidence: 0.9, required: false },
      ],
      sequential: [],
    };
  }

  private routeToDiscord(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "discord", confidence: intent.confidence, required: true },
    };
  }

  private routeToTelegram(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "telegram", confidence: intent.confidence, required: true },
    };
  }

  private routeToWeb(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "web", confidence: intent.confidence, required: false },
    };
  }

  private routeToEmail(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "email", confidence: intent.confidence, required: true },
    };
  }

  private routeToNotion(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "notion", confidence: intent.confidence, required: false },
    };
  }

  private routeToCron(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "cron", confidence: intent.confidence, required: false },
    };
  }

  private routeToSecrets(intent: Intent): DispatchPlan {
    return {
      parallel: [],
      sequential: [],
      primary: { agentId: "secrets", confidence: intent.confidence, required: true },
    };
  }
}
