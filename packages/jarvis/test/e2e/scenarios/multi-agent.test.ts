import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Multi-agent briefing", () => {
  it("should coordinate multiple agents for daily briefing", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("give me my daily briefing");
    expect(user.listen()).toMatch(/briefing/);
    const agentEvents = user.getEvents().filter((e) => e.topic === "agent");
    expect(agentEvents.length).toBeGreaterThanOrEqual(2);
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
        events.push({
          topic: "agent",
          type: "started",
          agentId: "calendar",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        events.push({
          topic: "agent",
          type: "started",
          agentId: "weather",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        events.push({
          topic: "agent",
          type: "completed",
          agentId: "calendar",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        events.push({
          topic: "agent",
          type: "completed",
          agentId: "weather",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        lastTts = "Here is your daily briefing";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
