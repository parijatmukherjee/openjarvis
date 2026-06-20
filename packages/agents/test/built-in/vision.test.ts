import { describe, it, expect } from "vitest";
import type {
  VisionAgent,
  VisionIntent,
  VisionContext,
  VisionAgentResult,
} from "../../src/built-in/vision.js";

describe("VisionAgent interface", () => {
  it("VisionAgentResult has required output fields", () => {
    const result: VisionAgentResult = {
      agentId: "vision",
      agentName: "VisionAgent",
      output: {
        summary: "I see a person",
        objects: [
          { label: "person", confidence: 0.95, bbox: { x: 0, y: 0, width: 100, height: 200 } },
        ],
        presence: "present",
      },
      success: true,
      auditEntry: { kind: "vision", at: Date.now(), data: {} },
    };

    expect(result.output).toHaveProperty("summary");
    expect(result.output).toHaveProperty("objects");
    expect(result.output).toHaveProperty("presence");
    expect(Array.isArray(result.output.objects)).toBe(true);
  });

  it("VisionIntent supports vision_query action", () => {
    const intent: VisionIntent = {
      action: "vision_query",
      params: {},
    };
    expect(intent.action).toBe("vision_query");
  });

  it("VisionIntent supports vision_count action with label param", () => {
    const intent: VisionIntent = {
      action: "vision_count",
      params: { label: "person" },
    };
    expect(intent.action).toBe("vision_count");
    expect(intent.params.label).toBe("person");
  });

  it("VisionIntent supports vision_presence action", () => {
    const intent: VisionIntent = {
      action: "vision_presence",
      params: {},
    };
    expect(intent.action).toBe("vision_presence");
  });

  it("VisionContext carries sessionId and presenceState", () => {
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };
    expect(context.sessionId).toBe("sess-123");
    expect(context.presenceState).toBe("present");
  });

  it("VisionAgent interface requires execute method", () => {
    const agent: VisionAgent = {
      async execute(_intent, context) {
        return {
          agentId: "vision",
          agentName: "VisionAgent",
          output: { summary: "test", objects: [], presence: context.presenceState },
          success: true,
          auditEntry: { kind: "vision", at: Date.now(), data: {} },
        };
      },
    };
    expect(typeof agent.execute).toBe("function");
  });
});
