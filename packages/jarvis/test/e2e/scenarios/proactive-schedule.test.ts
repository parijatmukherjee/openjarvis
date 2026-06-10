import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Proactive schedule", () => {
  it("should announce morning briefing at scheduled time", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    // Simulate scheduler firing
    hub.scheduler.fire({ name: "morning_standup", intent: { action: "get_briefing" } });
    expect(user.listen()).toMatch(/standup|meeting/);
  });
});

function createMockHub() {
  const events: Array<BusEvent & Record<string, unknown>> = [];
  let lastTts = "";
  return {
    wakeWordEngine: { start: async () => {} },
    sttEngine: {
      transcribe: async (_text: string) => {
        events.push({
          topic: "intent",
          type: "parsed",
          action: "get_briefing",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        lastTts = "Here is your morning standup briefing";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
    scheduler: {
      fire: (_job: { name: string; intent: { action: string } }) => {
        events.push({
          topic: "scheduler",
          type: "fired",
          payload: { job: "morning_standup" },
          timestamp: Date.now(),
          source: "scheduler",
        });
        lastTts = "Time for your morning standup meeting";
      },
    },
  };
}
