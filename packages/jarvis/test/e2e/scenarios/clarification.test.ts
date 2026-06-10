import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Clarification", () => {
  it("should ask for clarification when intent is ambiguous", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("set a reminder");
    expect(user.listen()).toMatch(/For what time\?/);
    expect(user.getEvents()).toContainEqual(
      expect.objectContaining({ topic: "intent", ambiguous: true }),
    );
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
          action: "set_reminder",
          ambiguous: true,
          suggestedClarification: "For what time?",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        lastTts = "For what time?";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
