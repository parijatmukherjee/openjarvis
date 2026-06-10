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
    ]);
  }

  route(intent: Intent, _context: JarvisContext): DispatchPlan {
    const handler = this.rules.get(intent.action);
    if (handler) {
      return handler(intent);
    }
    return { parallel: [], sequential: [] };
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
}
