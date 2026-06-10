import { describe, it, expect } from "vitest";
import { MockUser } from "../../../src/e2e/mock-user.js";
import type { VisualCommand } from "../../../src/synthesis.js";
import type { BusEvent } from "../../../src/event-bus.js";

describe("E2E: Multi-monitor", () => {
  it("should open calendar on monitor 2 when requested", async () => {
    const hub = createMockHub();
    const user = new MockUser(hub);
    await user.say("show calendar on monitor 2");
    expect(user.seeScreen()).toContainEqual(
      expect.objectContaining({ type: "open_app", app: "calendar", monitor: 2 }),
    );
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
          action: "open_app",
          payload: { app: "calendar", monitor: 2 },
          timestamp: Date.now(),
          source: "stt",
        });
        commands.push({ type: "open_app", app: "calendar", monitor: 2 });
        lastTts = "Opening calendar on monitor 2";
      },
    },
    ttsEngine: { getLastOutput: () => lastTts },
    displayManager: { getCommands: () => commands },
    visionEngine: { getEvents: () => [] },
    eventBus: { getEvents: () => events },
    auditLog: { getEntries: () => [] },
  };
}
