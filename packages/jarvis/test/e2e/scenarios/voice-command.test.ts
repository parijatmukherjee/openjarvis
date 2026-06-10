import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { VisionEvent } from "../../../src/vision/events.js";
import type { BusEvent } from "../../../src/event-bus.js";
import type { AuditEntry } from "@openhawkins/core";

describe("E2E: Voice command", () => {
  it("should respond to 'what time is it?'", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("what time is it?");
    expect(user.listen()).toMatch(/3:45 PM/);
  });
});

function createMockHub() {
  const commands: VisualCommand[] = [];
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
        lastTts = "It's 3:45 PM";
        audit.push({} as AuditEntry);
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: () => commands },
    visionEngine: { getEvents: (): VisionEvent[] => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => audit },
  };
}
