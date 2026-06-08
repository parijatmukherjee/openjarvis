import { describe, it, expect } from "vitest";
import { runAgentTurn } from "../../src/loop/agent-loop.js";
import { ScriptedAdapter } from "../../src/models/scripted.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { diskFreeTool } from "../../src/tools/disk-free.js";
import type { AgentGrant } from "../../src/security/capability.js";
import type { AcceptPolicy } from "../../src/loop/turn.js";

const grant: AgentGrant = { agentId: "probe-agent", capabilities: [{ name: "host:info" }] };

describe("agent loop — correction fallback", () => {
  it("uses a default correction when the policy rejects without supplying one", async () => {
    let n = 0;
    const policy: AcceptPolicy = {
      evaluate: () => (n++ === 0 ? { accept: false } : { accept: true }),
    };
    const adapter = new ScriptedAdapter([
      { content: "guess", toolCalls: [] },
      { content: "final", toolCalls: [] },
    ]);
    const registry = new ToolRegistry();
    registry.register(diskFreeTool);

    const record = await runAgentTurn(
      { adapter, registry, grant, tools: [diskFreeTool], policy },
      "q",
    );
    expect(record.corrections).toEqual(["Reconsider your answer."]);
    expect(record.accepted).toBe(true);
  });
});
