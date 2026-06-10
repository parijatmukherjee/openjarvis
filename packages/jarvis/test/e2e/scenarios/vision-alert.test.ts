import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { VisionEvent } from "../../../src/vision/events.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Vision alert", () => {
  it("should greet user when presence changes from away to present", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    // Simulate vision event firing proactively
    hub.visionEngine.simulatePresenceChange("away", "present");
    expect(user.listen()).toMatch(/Welcome back/);
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
          action: "vision_query",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        lastTts = "I see a person and a coffee mug";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: {
      getEvents: (): VisionEvent[] =>
        events.filter((e) => e.topic === "vision").map((e) => e as unknown as VisionEvent),
      simulatePresenceChange: (_from: string, _to: string) => {
        events.push({
          topic: "vision",
          type: "presence_change",
          payload: { frameId: "f1", objects: [], presenceState: "present", confidence: 0.95 },
          timestamp: Date.now(),
          source: "vision",
        });
        lastTts = "Welcome back!";
      },
    },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
