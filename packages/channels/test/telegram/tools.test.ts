import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createTelegramSendTool,
  createTelegramReadTool,
  registerTelegramTools,
  type TelegramToolClients,
} from "../../src/telegram/tools.js";

function makeClients(): TelegramToolClients {
  return {
    sendMessage: vi.fn().mockResolvedValue({ messageId: 42 }),
    getChat: vi.fn().mockResolvedValue({
      id: -1001234,
      type: "supergroup",
      title: "Test Group",
      username: "testgroup",
    }) as () => Promise<{
      id: number;
      type: string;
      title: string | null;
      username: string | null;
    }>,
  };
}

const ctx = { agentId: "test-agent" };

describe("createTelegramSendTool", () => {
  it("registers with telegram:message capability", () => {
    const tool = createTelegramSendTool(makeClients());
    expect(tool.name).toBe("telegram_send");
    expect(tool.capabilities).toEqual([{ name: "telegram:message" }]);
  });

  it("sends message via client", async () => {
    const clients = makeClients();
    const tool = createTelegramSendTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = {
      agentId: "test-agent",
      capabilities: [{ name: "telegram:message" }],
    };
    const result = await reg.invoke(
      { id: "c1", tool: "telegram_send", args: { chatId: 12345, text: "hello" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ messageId: 42 });
    }
    expect(clients.sendMessage).toHaveBeenCalledWith(12345, "hello");
  });

  it("is denied without telegram:message capability", async () => {
    const clients = makeClients();
    const tool = createTelegramSendTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await reg.invoke(
      { id: "c2", tool: "telegram_send", args: { chatId: 12345, text: "hello" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });
});

describe("createTelegramReadTool", () => {
  it("registers with telegram:read capability", () => {
    const tool = createTelegramReadTool(makeClients());
    expect(tool.name).toBe("telegram_read");
    expect(tool.capabilities).toEqual([{ name: "telegram:read" }]);
  });

  it("gets chat info via client", async () => {
    const clients = makeClients();
    const tool = createTelegramReadTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "telegram:read" }] };
    const result = await reg.invoke(
      { id: "c3", tool: "telegram_read", args: { chatId: -1001234 } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: -1001234,
        type: "supergroup",
        title: "Test Group",
        username: "testgroup",
      });
    }
    expect(clients.getChat).toHaveBeenCalledWith(-1001234);
  });

  it("is denied without telegram:read capability", async () => {
    const clients = makeClients();
    const tool = createTelegramReadTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await reg.invoke(
      { id: "c4", tool: "telegram_read", args: { chatId: -1001234 } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });
});

describe("registerTelegramTools", () => {
  it("registers both tools into the registry", () => {
    const clients = makeClients();
    const reg = new ToolRegistry();
    registerTelegramTools(reg, clients);
    expect(reg.list().map((t) => t.name)).toContain("telegram_send");
    expect(reg.list().map((t) => t.name)).toContain("telegram_read");
  });
});
