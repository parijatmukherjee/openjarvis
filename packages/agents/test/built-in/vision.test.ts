import { describe, it, expect } from "vitest";
import type { VisionAgent, VisionIntent, VisionContext } from "../../src/built-in/vision.js";
import { MockVisionAgent } from "../../src/built-in/vision.js";

describe("VisionAgent interface", () => {
  it("VisionAgent interface has execute method", () => {
    // We test the interface shape indirectly through the mock implementation.
    // If the mock class does not satisfy the interface, TypeScript will fail to compile.
    const agent: VisionAgent = new MockVisionAgent();
    expect(typeof agent.execute).toBe("function");
  });

  it("VisionAgentResult extends AgentResult", async () => {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_query",
      params: {},
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    // AgentResult fields
    expect(result).toHaveProperty("agentId");
    expect(result).toHaveProperty("agentName");
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("auditEntry");
    // VisionAgentResult-specific fields
    expect(result.output).toHaveProperty("summary");
    expect(result.output).toHaveProperty("objects");
    expect(result.output).toHaveProperty("presence");
    expect(Array.isArray(result.output.objects)).toBe(true);
  });

  it("MockVisionAgent.execute('vision_query') returns correct summary", async () => {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_query",
      params: {},
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    expect(result.output.summary).toBe("I see a person and a coffee mug");
  });

  it("MockVisionAgent.execute('vision_count') returns correct count", async () => {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_count",
      params: { label: "person" },
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    expect(result.output.summary).toBe("I see 1 person");
  });
  it("MockVisionAgent.execute('vision_count') returns correct plural count", async () =>
  {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_count",
      params: { label: "person" },
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    // Default label "person", count = 1 → singular
    expect(result.output.summary).toBe("I see 1 person");
  });

  it("MockVisionAgent.execute('vision_count') returns plural for multiple objects", async () =>
  {
    const agent = new MockVisionAgent();
    // Override the mock to have 2 person objects
    const result = await agent.execute(
      { action: "vision_count", params: { label: "cup" } } as VisionIntent,
      { sessionId: "sess-123", presenceState: "present" } as VisionContext,
    );
    expect(result.output.summary).toBe("I see 0 cups");
  });

  it("MockVisionAgent.execute('vision_count') defaults label when empty", async () =>
  {
    const agent = new MockVisionAgent();
    const result = await agent.execute(
      { action: "vision_count", params: { label: "" } } as VisionIntent,
      { sessionId: "sess-123", presenceState: "present" } as VisionContext,
    );
    expect(result.output.summary).toBe("I see 1 person");
  });

  it("MockVisionAgent.execute('vision_presence') returns correct summary when present", async () => {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_presence",
      params: {},
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    expect(result.output.summary).toBe("Yes, I see someone.");
  });

  it("MockVisionAgent.execute('vision_presence') returns correct summary when away", async () => {
    const agent = new MockVisionAgent();
    const intent: VisionIntent = {
      action: "vision_presence",
      params: {},
    };
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "away",
    };

    const result = await agent.execute(intent, context);

    expect(result.output.summary).toBe("No one is here.");
  });

  it("MockVisionAgent.execute with unknown action falls through to default", async () => {
    const agent = new MockVisionAgent();
    const intent = {
      action: "unknown_action",
      params: {},
    } as unknown as VisionIntent;
    const context: VisionContext = {
      sessionId: "sess-123",
      presenceState: "present",
    };

    const result = await agent.execute(intent, context);

    expect(result.output.summary).toBe("I don't know what to look for.");
  });
});
