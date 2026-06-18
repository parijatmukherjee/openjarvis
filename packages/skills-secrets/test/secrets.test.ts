import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import { OpClient } from "../src/op-client.js";
import { createSecretsGetTool, registerSecretsTools } from "../src/tools.js";

const ctx = { agentId: "test-agent" };
const secretsGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "secrets:read" }],
};

function mockExec(stdout: string, stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

function mockExecError(message: string) {
  const error = new Error(message);
  return vi.fn().mockRejectedValue(error);
}

describe("OpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls op read with the correct reference", async () => {
    const exec = mockExec("my-secret-value\n");
    const client = new OpClient({ exec });
    const result = await client.read("op://vault/item/field");
    expect(exec).toHaveBeenCalledWith("op", ["read", "op://vault/item/field"], { timeout: 10_000 });
    expect(result).toBe("my-secret-value");
  });

  it("strips trailing newline from op output", async () => {
    const exec = mockExec("my-secret-value\n");
    const client = new OpClient({ exec });
    const result = await client.read("op://vault/item/field");
    expect(result).toBe("my-secret-value");
  });

  it("strips only the final trailing newline", async () => {
    const exec = mockExec("line1\nline2\n");
    const client = new OpClient({ exec });
    const result = await client.read("op://vault/item/field");
    expect(result).toBe("line1\nline2");
  });

  it("rejects references not starting with op://", async () => {
    const exec = mockExec("value\n");
    const client = new OpClient({ exec });
    await expect(client.read("vault/item/field")).rejects.toThrow(
      'invalid reference: must start with "op://"',
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it("handles op command not found (ENOENT)", async () => {
    const error = new Error("ENOENT: no such file or directory, stat 'op'");
    const exec = vi.fn().mockRejectedValue(error);
    const client = new OpClient({ exec });
    await expect(client.read("op://vault/item/field")).rejects.toThrow(
      "1Password CLI (op) not found",
    );
  });

  it("handles op command not found (not found in path)", async () => {
    const error = new Error("spawn op ENOENT: op not found");
    const exec = vi.fn().mockRejectedValue(error);
    const client = new OpClient({ exec });
    await expect(client.read("op://vault/item/field")).rejects.toThrow(
      "1Password CLI (op) not found",
    );
  });

  it("handles authentication errors", async () => {
    const error = new Error("authentication required: not signed in");
    const exec = vi.fn().mockRejectedValue(error);
    const client = new OpClient({ exec });
    await expect(client.read("op://vault/item/field")).rejects.toThrow(
      "1Password CLI not authenticated",
    );
  });

  it("handles item not found errors", async () => {
    const error = new Error("item doesn't exist");
    const exec = vi.fn().mockRejectedValue(error);
    const client = new OpClient({ exec });
    await expect(client.read("op://vault/item/field")).rejects.toThrow(
      "1Password item not found",
    );
  });

  it("rethrows unknown errors", async () => {
    const error = new Error("something else went wrong");
    const exec = vi.fn().mockRejectedValue(error);
    const client = new OpClient({ exec });
    await expect(client.read("op://vault/item/field")).rejects.toThrow(
      "something else went wrong",
    );
  });
});

describe("secrets_get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers with secrets:read capability", () => {
    const exec = mockExec("value\n");
    const opClient = new OpClient({ exec });
    const tool = createSecretsGetTool(opClient);
    expect(tool.name).toBe("secrets_get");
    expect(tool.capabilities).toEqual([{ name: "secrets:read" }]);
  });

  it("calls op read with correct reference and returns value", async () => {
    const exec = mockExec("secret123\n");
    const registry = new ToolRegistry();
    registerSecretsTools(registry, { exec });
    const result = await registry.invoke(
      { id: "c1", tool: "secrets_get", args: { reference: "op://vault/item/field" } },
      secretsGrant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { value: string }).value).toBe("secret123");
    }
  });

  it("is denied without secrets:read capability", async () => {
    const exec = mockExec("value\n");
    const registry = new ToolRegistry();
    registerSecretsTools(registry, { exec });
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await registry.invoke(
      { id: "c2", tool: "secrets_get", args: { reference: "op://vault/item/field" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("rejects invalid reference format via Zod validation", async () => {
    const exec = mockExec("value\n");
    const registry = new ToolRegistry();
    registerSecretsTools(registry, { exec });
    const result = await registry.invoke(
      { id: "c3", tool: "secrets_get", args: { reference: "vault/item/field" } },
      secretsGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid args/);
  });
});