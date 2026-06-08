import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";
import { diskFreeTool } from "../../src/tools/disk-free.js";

describe("ToolRegistry.get", () => {
  it("returns a registered tool by name and undefined for an unknown one", () => {
    const registry = new ToolRegistry();
    registry.register(diskFreeTool);
    expect(registry.get("disk_free")?.name).toBe("disk_free");
    expect(registry.get("does-not-exist")).toBeUndefined();
  });
});
