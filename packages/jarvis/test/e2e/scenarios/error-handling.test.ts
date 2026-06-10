import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Error handling", () => {
  it("should gracefully explain when agent fails", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("do something impossible");
    expect(user.listen()).toMatch(/sorry|unable|cannot/);
    expect(user.getEvents()).toContainEqual(
      expect.objectContaining({ topic: "agent", type: "failed" }),
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
          action: "unknown",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        events.push({
          topic: "agent",
          type: "failed",
          agentId: "default",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        lastTts = "I'm sorry, I'm unable to do that right now.";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
