import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { VisionEvent } from "../../../src/vision/events.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Vision query", () => {
  it("should respond to 'what do you see?'", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("what do you see?");
    expect(user.listen()).toMatch(/I see a person and a coffee mug/);
    expect(user.seeScreen()).toContainEqual(expect.objectContaining({ type: "open_vision_feed" }));
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
          action: "vision_query",
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
            ],
            presenceState: "present",
            confidence: 0.92,
          },
          timestamp: Date.now(),
          source: "vision",
        });
        commands.push({ type: "open_vision_feed" });
        lastTts = "I see a person and a coffee mug";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: () => commands },
    visionEngine: {
      getEvents: (): VisionEvent[] =>
        events.filter((e) => e.topic === "vision").map((e) => e as unknown as VisionEvent),
    },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
