import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Vision count", () => {
  it("should count people in the room", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("how many people are in the room?");
    expect(user.listen()).toMatch(/I see \d+ people?/);
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
          action: "count_people",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        events.push({
          topic: "vision",
          type: "frame",
          payload: {
            frameId: "f1",
            objects: [
              {
                label: "person",
                confidence: 0.92,
                bbox: { x: 100, y: 100, width: 200, height: 300 },
              },
              {
                label: "person",
                confidence: 0.88,
                bbox: { x: 400, y: 100, width: 200, height: 300 },
              },
            ],
            presenceState: "present",
            confidence: 0.92,
          },
          timestamp: Date.now(),
          source: "vision",
        });
        lastTts = "I see 2 people in the room";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
