import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { diskFreeTool } from "../../src/tools/disk-free.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { AgentGrant } from "../../src/security/capability.js";

const ctx = { agentId: "probe-agent" };

describe("disk_free tool", () => {
  it("declares the host:info capability and a clear name", () => {
    expect(diskFreeTool.name).toBe("disk_free");
    expect(diskFreeTool.capabilities).toEqual([{ name: "host:info" }]);
  });

  it("returns a positive integer freeBytes for the temp dir when invoked with the grant", async () => {
    const reg = new ToolRegistry();
    reg.register(diskFreeTool);
    const grant: AgentGrant = { agentId: "probe-agent", capabilities: [{ name: "host:info" }] };
    const res = await reg.invoke(
      { id: "c1", tool: "disk_free", args: { path: tmpdir() } },
      grant,
      ctx,
    );
    expect(res.ok).toBe(true);
    const data = res.data as { path: string; freeBytes: number };
    expect(data.path).toBe(tmpdir());
    expect(Number.isInteger(data.freeBytes)).toBe(true);
    expect(data.freeBytes).toBeGreaterThan(0);
  });

  it("is denied for an agent without host:info", async () => {
    const reg = new ToolRegistry();
    reg.register(diskFreeTool);
    const noGrant: AgentGrant = { agentId: "probe-agent", capabilities: [] };
    const res = await reg.invoke(
      { id: "c2", tool: "disk_free", args: { path: tmpdir() } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });
});
