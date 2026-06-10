import { randomUUID } from "node:crypto";
import type { Persona } from "./persona.js";
import type { IntentParser } from "./intent.js";
import type { Delegator } from "./agents/delegator.js";
import type { Synthesizer } from "./synthesis.js";
import type { DisplayManager } from "./display/display-manager.js";
import type { TtsEngine } from "./voice/tts.js";
import type { WakeWordEngine } from "./voice/wake-word.js";
import type { Scheduler } from "./scheduler.js";
import type { EventBus } from "./event-bus.js";
import type { JarvisContext } from "./context.js";

export interface JarvisHubConfig {
  persona: Persona;
  intentParser: IntentParser;
  delegator: Delegator;
  synthesizer: Synthesizer;
  displayManager: DisplayManager;
  ttsEngine: TtsEngine;
  wakeWordEngine: WakeWordEngine;
  scheduler: Scheduler;
  eventBus: EventBus;
  /** Testing seam: override the input source. */
  readInputOverride?: () => Promise<string>;
}

type JarvisState = "idle" | "listening" | "thinking" | "responding";

/**
 * The Jarvis hub orchestrator — the user's single conversational endpoint.
 *
 * Lifecycle: IDLE → LISTENING → THINKING → RESPONDING → IDLE
 *
 * - IDLE: Waiting for wake word.
 * - LISTENING: Wake word detected; collecting user input.
 * - THINKING: Parsing intent, delegating to agents, synthesizing response.
 * - RESPONDING: Speaking + displaying results.
 *
 * State transitions emit events on the EventBus so they are observable
 * and replayable.
 */
export class JarvisHub {
  private state: JarvisState = "idle";
  private recentIntents: import("./intent.js").Intent[] = [];
  private sessionId = randomUUID();

  constructor(private readonly cfg: JarvisHubConfig) {}

  /** Current state (for monitoring / testing). */
  get currentState(): JarvisState {
    return this.state;
  }

  /** Start listening for the wake word. */
  async start(): Promise<void> {
    await this.cfg.wakeWordEngine.start(() => void this.onWakeWord());
    await this.emitStateChange("idle", "idle");
  }

  /** Stop the hub. */
  async stop(): Promise<void> {
    await this.cfg.wakeWordEngine.stop();
    this.state = "idle";
  }

  /** Simulate a wake-word trigger directly (testing seam). */
  async simulateWake(): Promise<void> {
    await this.onWakeWord();
  }

  private async onWakeWord(): Promise<void> {
    if (this.state !== "idle") return;

    await this.transitionTo("listening");

    try {
      // In v1, the mock STT is synchronous; in v1.1 we'd await audio stream
      const input = await this.readInput();
      await this.transitionTo("thinking");

      const context = this.buildContext();
      const intent = await this.cfg.intentParser.parse(input, context);

      if (intent.ambiguous) {
        await this.speak(intent.suggestedClarification || "I'm not sure what you mean.");
        await this.transitionTo("idle");
        return;
      }

      this.recentIntents.push(intent);
      if (this.recentIntents.length > 10) {
        this.recentIntents.shift();
      }

      const results = await this.cfg.delegator.delegate(intent, context);
      const synthesis = await this.cfg.synthesizer.synthesize(results, intent, context);

      await this.transitionTo("responding");
      await this.speak(synthesis.spoken);

      if (synthesis.visual) {
        for (const cmd of synthesis.visual) {
          await this.executeVisualCommand(cmd);
        }
      }

      await this.transitionTo("idle");
    } catch (err) {
      await this.speak("Something went wrong. Please try again.");
      await this.transitionTo("idle");
      throw err;
    }
  }

  private async readInput(): Promise<string> {
    if (this.cfg.readInputOverride) {
      return this.cfg.readInputOverride();
    }
    // v1: Mock returns pre-configured text.
    // v1.1: Read from real audio stream.
    return "";
  }

  private async speak(text: string): Promise<void> {
    await this.cfg.ttsEngine.synthesize(text);
  }

  private async executeVisualCommand(cmd: import("./synthesis.js").VisualCommand): Promise<void> {
    switch (cmd.type) {
      case "open_app":
        await this.cfg.displayManager.openApp(cmd.app, cmd.monitor?.toString());
        break;
      case "open_url":
        await this.cfg.displayManager.openUrl(cmd.url, cmd.monitor?.toString());
        break;
      case "show_text":
        await this.cfg.displayManager.showText(cmd.text, cmd.monitor?.toString());
        break;
      case "clear":
        await this.cfg.displayManager.clear(cmd.monitor?.toString());
        break;
      case "open_vision_feed":
        if (this.cfg.displayManager.openVisionFeed) {
          await this.cfg.displayManager.openVisionFeed(cmd.monitor?.toString());
        }
        break;
      case "show_agent_output":
        if (this.cfg.displayManager.showAgentOutput) {
          await this.cfg.displayManager.showAgentOutput(cmd.agentId, cmd.monitor?.toString());
        }
        break;
      case "show_context_card":
        if (this.cfg.displayManager.showContextCard) {
          await this.cfg.displayManager.showContextCard(
            cmd.title,
            cmd.body,
            cmd.monitor?.toString(),
          );
        }
        break;
    }
  }

  private buildContext(): JarvisContext {
    return {
      sessionId: this.sessionId,
      userId: "default-user",
      recentIntents: [...this.recentIntents],
      currentTime: new Date(),
    };
  }

  private async transitionTo(newState: JarvisState): Promise<void> {
    const oldState = this.state;
    this.state = newState;
    await this.emitStateChange(oldState, newState);
  }

  private async emitStateChange(from: JarvisState, to: JarvisState): Promise<void> {
    await this.cfg.eventBus.publish({
      topic: "jarvis.state_changed",
      payload: { from, to, sessionId: this.sessionId },
      timestamp: Date.now(),
      source: "jarvis",
    });
  }
}
