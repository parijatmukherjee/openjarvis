import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createDiscordSendTool,
  createDiscordReadTool,
  createDiscordSearchTool,
  registerDiscordTools,
  type DiscordToolClients,
} from "../../src/discord/tools.js";

function makeClients(): DiscordToolClients {
  return {
    sendMessage: vi.fn().mockResolvedValue({ messageId: "msg123" }),
    getChannel: vi.fn().mockResolvedValue({
      id: "chan1",
      name: "general",
      guildId: "guild1",
      type: "text",
    }),
    searchMessages: vi.fn().mockResolvedValue([
      {
        id: "m1",
        channelId: "chan1",
        guildId: "guild1",
        authorId: "u1",
        authorUsername: "alice",
        content: "hello world",
        timestamp: 1704067200000,
        editedTimestamp: null,
        attachments: [],
      },
    ]),
  };
}

const ctx = { agentId: "test-agent" };

describe("createDiscordSendTool", () => {
  it("registers with correct capabilities", () => {
    const tool = createDiscordSendTool(makeClients());
    expect(tool.name).toBe("discord_send");
    expect(tool.capabilities).toEqual([{ name: "discord:message" }]);
  });

  it("invokes rest client and returns messageId", async () => {
    const clients = makeClients();
    const tool = createDiscordSendTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = {
      agentId: "test-agent",
      capabilities: [{ name: "discord:message" }],
    };
    const result = await reg.invoke(
      { id: "c1", tool: "discord_send", args: { channelId: "chan1", content: "hello" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ messageId: "msg123" });
    }
    expect(clients.sendMessage).toHaveBeenCalledWith("chan1", "hello");
  });

  it("is denied without discord:message capability", async () => {
    const clients = makeClients();
    const tool = createDiscordSendTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await reg.invoke(
      { id: "c2", tool: "discord_send", args: { channelId: "chan1", content: "hello" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });
});

describe("createDiscordReadTool", () => {
  it("registers with correct capabilities", () => {
    const tool = createDiscordReadTool(makeClients());
    expect(tool.name).toBe("discord_read");
    expect(tool.capabilities).toEqual([{ name: "discord:read" }]);
  });

  it("invokes rest client and returns channel info", async () => {
    const clients = makeClients();
    const tool = createDiscordReadTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "discord:read" }] };
    const result = await reg.invoke(
      { id: "c3", tool: "discord_read", args: { channelId: "chan1" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: "chan1",
        name: "general",
        guildId: "guild1",
        type: "text",
      });
    }
    expect(clients.getChannel).toHaveBeenCalledWith("chan1");
  });

  it("is denied without discord:read capability", async () => {
    const clients = makeClients();
    const tool = createDiscordReadTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await reg.invoke(
      { id: "c4", tool: "discord_read", args: { channelId: "chan1" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });
});

describe("createDiscordSearchTool", () => {
  it("registers with correct capabilities", () => {
    const tool = createDiscordSearchTool(makeClients());
    expect(tool.name).toBe("discord_search");
    expect(tool.capabilities).toEqual([{ name: "discord:read" }]);
  });

  it("invokes searchMessages and returns results", async () => {
    const clients = makeClients();
    const tool = createDiscordSearchTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "discord:read" }] };
    const result = await reg.invoke(
      { id: "c5", tool: "discord_search", args: { channelId: "chan1", query: "hello" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        {
          id: "m1",
          channelId: "chan1",
          guildId: "guild1",
          authorId: "u1",
          authorUsername: "alice",
          content: "hello world",
          timestamp: 1704067200000,
          editedTimestamp: null,
          attachments: [],
        },
      ]);
    }
    expect(clients.searchMessages).toHaveBeenCalledWith("chan1", "hello", undefined);
  });

  it("passes limit parameter to searchMessages", async () => {
    const clients = makeClients();
    const tool = createDiscordSearchTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "discord:read" }] };
    const result = await reg.invoke(
      { id: "c6", tool: "discord_search", args: { channelId: "chan1", query: "hello", limit: 5 } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(clients.searchMessages).toHaveBeenCalledWith("chan1", "hello", 5);
  });

  it("is denied without discord:read capability", async () => {
    const clients = makeClients();
    const tool = createDiscordSearchTool(clients);
    const reg = new ToolRegistry();
    reg.register(tool);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await reg.invoke(
      { id: "c7", tool: "discord_search", args: { channelId: "chan1", query: "hello" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });
});

describe("registerDiscordTools", () => {
  it("registers all three tools into the registry", () => {
    const clients = makeClients();
    const reg = new ToolRegistry();
    registerDiscordTools(reg, clients);
    expect(reg.list().map((t) => t.name)).toContain("discord_send");
    expect(reg.list().map((t) => t.name)).toContain("discord_read");
    expect(reg.list().map((t) => t.name)).toContain("discord_search");
  });
});
