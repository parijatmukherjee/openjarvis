import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createEmailSearchTool,
  createEmailReadTool,
  createEmailDraftTool,
  createEmailSendTool,
  registerEmailTools,
} from "../src/tools.js";
import type { EmailToolClients } from "../src/types.js";

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
    await tool.handler({ provider: "gmail", query: "from:alice", folder: "INBOX", limit: 10 }, ctx);
    expect(clients.gmail!.search).toHaveBeenCalledWith("from:alice");
  });

  it("calls graph search when provider is graph", async () => {
    const clients = makeClients();
    const tool = createEmailSearchTool(clients);
    await tool.handler(
      { provider: "graph", query: "project update", folder: "INBOX", limit: 10 },
      ctx,
    );
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
    await tool.handler({ provider: "gmail", messageId: "42", folder: "INBOX", limit: 20 }, ctx);
    expect(clients.gmail!.getMessage).toHaveBeenCalledWith("42");
  });

  it("calls listMessages when no messageId is provided", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", folder: "INBOX", limit: 20 }, ctx);
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

  it("throws when gmail provider not configured", async () => {
    const clients: EmailToolClients = { gmail: undefined, graph: makeClients().graph };
    const tool = createEmailSearchTool(clients);
    await expect(
      tool.handler({ provider: "gmail", query: "test", folder: "INBOX", limit: 10 }, ctx),
    ).rejects.toThrow("gmail provider not configured");
  });

  it("throws when graph provider not configured", async () => {
    const clients: EmailToolClients = { gmail: makeClients().gmail, graph: undefined };
    const tool = createEmailSearchTool(clients);
    await expect(
      tool.handler({ provider: "graph", query: "test", folder: "INBOX", limit: 10 }, ctx),
    ).rejects.toThrow("graph provider not configured");
  });

  it("throws when gmail provider not configured in email_read", async () => {
    const clients: EmailToolClients = { gmail: undefined, graph: makeClients().graph };
    const tool = createEmailReadTool(clients);
    await expect(
      tool.handler({ provider: "gmail", folder: "INBOX", limit: 20 }, ctx),
    ).rejects.toThrow("gmail provider not configured");
  });

  it("throws when graph provider not configured in email_read", async () => {
    const clients: EmailToolClients = { gmail: makeClients().gmail, graph: undefined };
    const tool = createEmailReadTool(clients);
    await expect(
      tool.handler({ provider: "graph", messageId: "1", folder: "INBOX", limit: 20 }, ctx),
    ).rejects.toThrow("graph provider not configured");
  });

  it("throws when gmail provider not configured in email_send", async () => {
    const clients: EmailToolClients = { gmail: undefined, graph: makeClients().graph };
    const tool = createEmailSendTool(clients);
    await expect(
      tool.handler(
        { provider: "gmail", to: [{ address: "x@y.com" }], subject: "Hi", body: "yo" },
        ctx,
      ),
    ).rejects.toThrow("gmail provider not configured");
  });

  it("throws when graph provider not configured in email_send", async () => {
    const clients: EmailToolClients = { gmail: makeClients().gmail, graph: undefined };
    const tool = createEmailSendTool(clients);
    await expect(
      tool.handler(
        { provider: "graph", to: [{ address: "x@y.com" }], subject: "Hi", body: "yo" },
        ctx,
      ),
    ).rejects.toThrow("graph provider not configured");
  });
});

describe("createEmailSendTool branches", () => {
  it("sends with cc and htmlBody", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    await tool.handler(
      {
        provider: "gmail",
        to: [{ name: "Bob", address: "bob@example.com" }],
        cc: [{ name: "Carol", address: "carol@example.com" }],
        subject: "Hello",
        body: "Hi",
        htmlBody: "<p>Hi</p>",
      },
      ctx,
    );
    expect(clients.gmail!.send).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: [{ name: "Carol", address: "carol@example.com" }],
        htmlBody: "<p>Hi</p>",
      }),
    );
  });

  it("sends without name in to address", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    await tool.handler(
      {
        provider: "gmail",
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi",
      },
      ctx,
    );
    expect(clients.gmail!.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ address: "bob@example.com" }],
      }),
    );
  });

  it("calls graph send when provider is graph", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    await tool.handler(
      {
        provider: "graph",
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi",
      },
      ctx,
    );
    expect(clients.graph!.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi",
      }),
    );
  });

  it("sends with attachments", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    const attachment = new Uint8Array([1, 2, 3]);
    await tool.handler(
      {
        provider: "gmail",
        to: [{ name: "Bob", address: "bob@example.com" }],
        subject: "File attached",
        body: "See attached",
        attachments: [{ filename: "test.txt", contentType: "text/plain", content: attachment }],
      },
      ctx,
    );
    expect(clients.gmail!.send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "test.txt", contentType: "text/plain", content: attachment }],
      }),
    );
  });
});

describe("createEmailReadTool branches", () => {
  it("reads message by id using graph provider", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "graph", messageId: "g1", folder: "INBOX", limit: 20 }, ctx);
    expect(clients.graph!.getMessage).toHaveBeenCalledWith("g1");
  });

  it("reads message by id using gmail provider", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", messageId: "1", folder: "INBOX", limit: 20 }, ctx);
    expect(clients.gmail!.getMessage).toHaveBeenCalledWith("1");
  });

  it("lists messages with custom limit", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", folder: "INBOX", limit: 5 }, ctx);
    expect(clients.gmail!.listMessages).toHaveBeenCalledWith("INBOX", { limit: 5 });
  });

  it("lists messages with default limit of 20", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", folder: "INBOX", limit: 20 }, ctx);
    expect(clients.gmail!.listMessages).toHaveBeenCalledWith("INBOX", { limit: 20 });
  });
});
