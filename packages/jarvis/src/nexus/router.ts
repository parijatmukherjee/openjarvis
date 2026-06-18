import type { Intent, JarvisContext, DispatchPlan } from "./types.js";

export interface IntentRouter {
  route(intent: Intent, context: JarvisContext): DispatchPlan;
}

export class RuleBasedRouter implements IntentRouter {
  private rules: Map<string, (intent: Intent) => DispatchPlan>;

  constructor() {
    this.rules = new Map([
      ["search", this.routeToResearch],
      ["get_updates", this.routeToParallel],
      ["open_app", this.routeToSystem],
      ["check_weather", this.routeToWeather],
      ["check_calendar", this.routeToCalendar],
      ["browse", this.routeToBrowser],
      ["vision_query", this.routeToVision],
      ["send_discord", this.routeToDiscord],
      ["read_discord", this.routeToDiscord],
      ["send_telegram", this.routeToTelegram],
      ["read_telegram", this.routeToTelegram],
      ["fetch_url", this.routeToWeb],
      ["search_email", this.routeToEmail],
      ["read_email", this.routeToEmail],
      ["draft_email", this.routeToEmail],
      ["send_email", this.routeToEmail],
      ["calendar_list", this.routeToCalendar],
      ["calendar_get_events", this.routeToCalendar],
      ["calendar_create", this.routeToCalendar],
      ["calendar_update", this.routeToCalendar],
      ["calendar_delete", this.routeToCalendar],
      ["query_notion", this.routeToNotion],
      ["get_notion", this.routeToNotion],
      ["create_notion", this.routeToNotion],
      ["update_notion", this.routeToNotion],
    ]);
  }

  route(intent: Intent, _context: JarvisContext): DispatchPlan {
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
}
