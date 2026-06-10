import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Auto-display", () => {
  it("should open weather website when asking about weather", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("what's the weather?");
    expect(user.listen()).toMatch(/72°F/);
    expect(user.seeScreen()).toContainEqual(
      expect.objectContaining({ type: "open_url", url: expect.stringContaining("weather") }),
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
      transcribe: async (_text: string) => {
        events.push({
          topic: "intent",
          type: "parsed",
          action: "get_weather",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        commands.push({ type: "open_url", url: "https://weather.example.com" });
        lastTts = "It's 72°F and sunny";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: () => commands },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
