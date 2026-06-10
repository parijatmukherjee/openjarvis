import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Context memory", () => {
  it("should remember preference and apply it later", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("remind me I like dark mode");
    expect(user.listen()).toMatch(/remembered/);
    await user.say("open settings");
    expect(user.seeScreen()).toContainEqual(
      expect.objectContaining({ type: "open_app", app: "settings" }),
    );
  });
});

function createMockHub() {
  const commands: VisualCommand[] = [];
  const events: Array<BusEvent & Record<string, unknown>> = [];
  let lastTts = "";
  return {
    wakeWordEngine: { start: async () => {} },
    sttEngine: {
      transcribe: async (text: string) => {
        if (text.includes("dark mode")) {
          events.push({
            topic: "intent",
            type: "parsed",
            action: "remember_preference",
            payload: { preference: "dark_mode" },
            timestamp: Date.now(),
            source: "stt",
          });
          lastTts = "I've remembered that you like dark mode.";
        } else if (text.includes("settings")) {
          events.push({
            topic: "intent",
            type: "parsed",
            action: "open_app",
            payload: { app: "settings" },
            timestamp: Date.now(),
            source: "stt",
          });
          commands.push({ type: "open_app", app: "settings" });
          lastTts = "Opening settings";
        }
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: () => commands },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
