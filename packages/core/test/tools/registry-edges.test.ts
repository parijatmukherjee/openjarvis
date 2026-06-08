import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { ToolDefinition } from "../../src/tools/tool.js";
import type { AgentGrant } from "../../src/security/capability.js";

describe("ToolRegistry — non-Error handler throw", () => {
  it("stringifies a non-Error value thrown by a handler", async () => {
    const registry = new ToolRegistry();
    const tool: ToolDefinition<Record<string, never>, { ok: boolean }> = {
      name: "boom2",
      description: "throws a string",
      args: z.object({}),
      result: z.object({ ok: z.boolean() }),
      capabilities: [{ name: "host:info" }],
      handler: async () => {
        throw "plain-string-error";
      },
    };
    registry.register(tool);
    const grant: AgentGrant = { agentId: "a", capabilities: [{ name: "host:info" }] };

    const res = await registry.invoke({ id: "c", tool: "boom2", args: {} }, grant, {
      agentId: "a",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("plain-string-error");
  });
});
