import { describe, it, expect } from "vitest";
import { Agent } from "../../src/eval/agent.js";
import { ScriptedAdapter } from "../../src/models/scripted.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { diskFreeTool } from "../../src/tools/disk-free.js";

describe("Agent with memory injection", () => {
  it("injects recalled fragments into the system prompt", async () => {
    const memory = {
      recall: async (_query: string) => ["Remember: the answer is 42."],
    };

    // Capture the system prompt the model receives.
    let receivedSystemPrompt = "";
    const adapter = new ScriptedAdapter(
      [
        (req) => {
          const sys = req.messages.find((m) => m.role === "system");
          receivedSystemPrompt = sys?.content ?? "";
          return { content: "ok", toolCalls: [] };
        },
      ],
      "capture-system",
    );

    const registry = new ToolRegistry();
    registry.register(diskFreeTool);
    const agent = await Agent.start({
      agentId: "test-agent",
      adapter,
      registry,
      grant: { agentId: "test-agent", capabilities: [{ name: "host:info" }] },
      tools: [diskFreeTool],
      grounding: { mode: "off" },
      memory,
    });

    await agent.ask("What is the answer?");
    expect(receivedSystemPrompt).toContain("Remember: the answer is 42.");
  });

  it("does not break when memory returns nothing", async () => {
    const memory = { recall: async (_query: string) => [] as string[] };
    const adapter = new ScriptedAdapter([{ content: "ok", toolCalls: [] }], "silent");

    const registry = new ToolRegistry();
    registry.register(diskFreeTool);
    const agent = await Agent.start({
      agentId: "test-agent",
      adapter,
      registry,
      grant: { agentId: "test-agent", capabilities: [{ name: "host:info" }] },
      tools: [diskFreeTool],
      grounding: { mode: "off" },
      memory,
    });

    const record = await agent.ask("hello");
    expect(record.accepted).toBe(true);
    expect(record.final).toBe("ok");
  });
});
