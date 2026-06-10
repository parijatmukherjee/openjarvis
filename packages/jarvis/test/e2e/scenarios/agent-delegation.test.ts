import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Agent delegation", () => {
  it("should delegate to ResearchAgent for product search", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("find me a keyboard under $150");
    expect(user.listen()).toMatch(/mechanical keyboards/);
    expect(user.getEvents()).toContainEqual(
      expect.objectContaining({ topic: "agent", type: "started", agentId: "research" }),
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
          action: "product_search",
          payload: { query: "keyboard under $150" },
          timestamp: Date.now(),
          source: "stt",
        });
        events.push({
          topic: "agent",
          type: "started",
          agentId: "research",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        lastTts = "Here are some mechanical keyboards under $150";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
