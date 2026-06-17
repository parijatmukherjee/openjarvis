import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createEmailSearchTool,
  createEmailReadTool,
  createEmailDraftTool,
  createEmailSendTool,
  registerEmailTools,
  type EmailToolClients,
} from "../src/tools.js";

const ctx = { agentId: "test-agent" };

function makeClients(): EmailToolClients {
  return {
    gmail: {
      listFolders: vi.fn().mockResolvedValue([{ name: "INBOX", path: "INBOX", delimiter: "." }]),
      listMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue({
        id: "1",
        from: { name: "A", address: "a@b.com" },
        to: [],
        cc: [],
        subject: "Test",
        body: "Hello",
        date: "2026-06-17T00:00:00Z",
        attachments: [],
        folder: "INBOX",
        flags: [],
      }),
      send: vi.fn().mockResolvedValue("msg123"),
      search: vi.fn().mockResolvedValue([]),
    },
    graph: {
      listFolders: vi.fn().mockResolvedValue([{ name: "Inbox", path: "inbox", delimiter: "/" }]),
      listMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue({
        id: "g1",
        from: { name: "A", address: "a@b.com" },
        to: [],
        cc: [],
        subject: "Test",
        body: "Hello",
        date: "2026-06-17T00:00:00Z",
        attachments: [],
        folder: "Inbox",
        flags: [],
      }),
      send: vi.fn().mockResolvedValue("sent"),
      search: vi.fn().mockResolvedValue([]),
      startDeviceCodeAuth: vi.fn().mockResolvedValue({
        deviceCode: "dc123",
        userCode: "ABC-XYZ",
        verificationUrl: "https://microsoft.com/devicelogin",
        expiresIn: 900,
        interval: 5,
      }),
      waitForAuth: vi.fn().mockResolvedValue({ success: true }),
      refreshToken: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

describe("createEmailSearchTool", () => {
  it("registers with email:read capability", () => {
    const tool = createEmailSearchTool(makeClients());
    expect(tool.name).toBe("email_search");
    expect(tool.capabilities).toEqual([{ name: "email:read" }]);
  });

  it("calls gmail search when provider is gmail", async () => {
    const clients = makeClients();
    const tool = createEmailSearchTool(clients);
    await tool.handler({ provider: "gmail", query: "from:alice" }, ctx);
    expect(clients.gmail!.search).toHaveBeenCalledWith("from:alice");
  });

  it("calls graph search when provider is graph", async () => {
    const clients = makeClients();
    const tool = createEmailSearchTool(clients);
    await tool.handler({ provider: "graph", query: "project update" }, ctx);
    expect(clients.graph!.search).toHaveBeenCalledWith("project update");
  });
});

describe("createEmailReadTool", () => {
  it("registers with email:read capability", () => {
    const tool = createEmailReadTool(makeClients());
    expect(tool.name).toBe("email_read");
    expect(tool.capabilities).toEqual([{ name: "email:read" }]);
  });

  it("calls getMessage when messageId is provided", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", messageId: "42" }, ctx);
    expect(clients.gmail!.getMessage).toHaveBeenCalledWith("42");
  });

  it("calls listMessages when no messageId is provided", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", folder: "INBOX" }, ctx);
    expect(clients.gmail!.listMessages).toHaveBeenCalledWith("INBOX", expect.any(Object));
  });
});

describe("createEmailDraftTool", () => {
  it("registers with email:send capability", () => {
    const tool = createEmailDraftTool(makeClients());
    expect(tool.name).toBe("email_draft");
    expect(tool.capabilities).toEqual([{ name: "email:send" }]);
  });

  it("returns a draftId and preview without sending", async () => {
    const clients = makeClients();
    const tool = createEmailDraftTool(clients);
    const result = await tool.handler(
      {
        provider: "gmail",
        to: [{ address: "bob@example.com" }],
        subject: "Test draft",
        body: "Draft body",
      },
      ctx,
    );
    expect(result.draftId).toBeDefined();
    expect(result.preview.subject).toBe("Test draft");
    expect(clients.gmail!.send).not.toHaveBeenCalled();
  });
});

describe("createEmailSendTool", () => {
  it("registers with email:send capability", () => {
    const tool = createEmailSendTool(makeClients());
    expect(tool.name).toBe("email_send");
    expect(tool.capabilities).toEqual([{ name: "email:send" }]);
  });

  it("calls gmail send when provider is gmail", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    await tool.handler(
      {
        provider: "gmail",
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi Bob",
      },
      ctx,
    );
    expect(clients.gmail!.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi Bob",
      }),
    );
  });
});

describe("registerEmailTools", () => {
  it("registers all four email tools", () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("email_search");
    expect(names).toContain("email_read");
    expect(names).toContain("email_draft");
    expect(names).toContain("email_send");
  });

  it("denies email_send without email:send capability", async () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await registry.invoke(
      {
        id: "c1",
        tool: "email_send",
        args: { provider: "gmail", to: [{ address: "x@y.com" }], subject: "Hi", body: "yo" },
      },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("allows email_search with email:read capability", async () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "email:read" }] };
    const result = await registry.invoke(
      { id: "c2", tool: "email_search", args: { provider: "gmail", query: "test" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });
});
