import { describe, it, expect } from "vitest";
import { NexusEngine } from "../../src/nexus/engine.js";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import { InProcessAgentPool } from "../../src/nexus/pool.js";
import { RuleBasedSynthesizer } from "../../src/nexus/synthesizer.js";
import { SimpleEventBus } from "../../src/event-bus/simple.js";
import { MockModelClient } from "../../src/model/mock-client.js";

describe("NexusEngine.executeChatStream", () => {
  it("calls onChunk for each model chunk and once more on done", async () => {
    const bus = new SimpleEventBus();
    const client = new MockModelClient();
    const engine = new NexusEngine({
      intentRouter: new RuleBasedRouter(client),
      agentPool: new InProcessAgentPool(client),
      synthesizer: new RuleBasedSynthesizer(client),
      eventBus: bus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 5000,
    });

    const chunks: string[] = [];
    await engine.executeChatStream("hello", (c) => chunks.push(c.text));
    expect(chunks.join("")).toContain("mock");
  });
});
