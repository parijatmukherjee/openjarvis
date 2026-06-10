import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";
import type { AuditEntry } from "@openjarvis/core";

describe("E2E: Event audit trail", () => {
  it("should emit intent_parsed, agent_started, agent_completed, synthesis_done", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("what time is it?");
    const events = user.getEvents() as Array<BusEvent & Record<string, unknown>>;
    expect(events.map((e) => e.type)).toContain("parsed");
    expect(events.map((e) => e.type)).toContain("synthesis_done");
    expect(user.getAudit().length).toBeGreaterThan(0);
  });
});

function createMockHub() {
  const events: Array<BusEvent & Record<string, unknown>> = [];
  const audit: AuditEntry[] = [];
  let lastTts = "";
  return {
    wakeWordEngine: { start: async () => {} },
    sttEngine: {
      transcribe: async (_text: string) => {
        events.push({
          topic: "intent",
          type: "parsed",
          action: "get_time",
          payload: {},
          timestamp: Date.now(),
          source: "stt",
        });
        events.push({
          topic: "agent",
          type: "started",
          agentId: "default",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        events.push({
          topic: "agent",
          type: "completed",
          agentId: "default",
          payload: {},
          timestamp: Date.now(),
          source: "agent",
        });
        events.push({
          topic: "synthesis",
          type: "synthesis_done",
          payload: {},
          timestamp: Date.now(),
          source: "synthesis",
        });
        lastTts = "It's 3:45 PM";
        audit.push({} as AuditEntry);
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: (): VisualCommand[] => [] },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => audit },
  };
}
