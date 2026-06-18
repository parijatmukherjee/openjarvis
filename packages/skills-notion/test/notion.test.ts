import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createNotionQueryTool,
  createNotionGetTool,
  createNotionCreateTool,
  createNotionUpdateTool,
  registerNotionTools,
} from "../src/tools.js";

const ctx = { agentId: "test-agent" };

function mockNotionFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  let callIndex = 0;
  const fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    const { status, body } = responses[callIndex++] ?? { status: 200, body: {} };
    calls.push({
      method: init.method ?? "GET",
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
  return { fetch, calls };
}

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    url: "https://notion.so/page-1",
    created_time: "2026-01-01T00:00:00Z",
    last_edited_time: "2026-01-02T00:00:00Z",
    properties: {
      Name: { title: [{ plain_text: "Test Page" }] },
    },
    ...overrides,
  };
}

const notionReadGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "notion:read" }],
};
const notionWriteGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "notion:write" }],
};
const notionAllGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "notion:read" }, { name: "notion:write" }],
};
const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };

describe("notion_query", () => {
  it("registers with notion:read capability", () => {
    const tool = createNotionQueryTool({ fetch: vi.fn() });
    expect(tool.name).toBe("notion_query");
    expect(tool.capabilities).toEqual([{ name: "notion:read" }]);
  });

  it("calls POST /v1/databases/{id}/query and maps results", async () => {
    const { fetch, calls } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [makePage()],
          has_more: false,
        },
      },
    ]);
    const tool = createNotionQueryTool({ fetch, token: "test-token" });
    const result = await tool.handler({ databaseId: "db-1" }, ctx);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe("page-1");
    expect(result.results[0].title).toBe("Test Page");
    expect(result.hasMore).toBe(false);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://api.notion.com/v1/databases/db-1/query");
  });

  it("passes filter and sorts as parsed JSON", async () => {
    const { fetch, calls } = mockNotionFetch([
      { status: 200, body: { results: [], has_more: false } },
    ]);
    const tool = createNotionQueryTool({ fetch, token: "test-token" });
    await tool.handler(
      {
        databaseId: "db-1",
        filter: '{"property":"Status","select":{"equals":"Done"}}',
        sorts: '[{"property":"Name","direction":"ascending"}]',
        limit: 10,
      },
      ctx,
    );
    const body = calls[0].body as Record<string, unknown>;
    expect(body.filter).toEqual({ property: "Status", select: { equals: "Done" } });
    expect(body.sorts).toEqual([{ property: "Name", direction: "ascending" }]);
    expect(body.page_size).toBe(10);
  });

  it("handles has_more and next_cursor", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [makePage()],
          has_more: true,
          next_cursor: "cursor-abc",
        },
      },
    ]);
    const tool = createNotionQueryTool({ fetch, token: "test-token" });
    const result = await tool.handler({ databaseId: "db-1" }, ctx);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("cursor-abc");
  });
});

describe("notion_get", () => {
  it("registers with notion:read capability", () => {
    const tool = createNotionGetTool({ fetch: vi.fn() });
    expect(tool.name).toBe("notion_get");
    expect(tool.capabilities).toEqual([{ name: "notion:read" }]);
  });

  it("calls GET /v1/pages/{id} and maps to NotionPage", async () => {
    const { fetch, calls } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const tool = createNotionGetTool({ fetch, token: "test-token" });
    const result = await tool.handler({ pageId: "page-1" }, ctx);
    expect(result.page.id).toBe("page-1");
    expect(result.page.title).toBe("Test Page");
    expect(result.page.url).toBe("https://notion.so/page-1");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe("https://api.notion.com/v1/pages/page-1");
  });
});

describe("notion_create", () => {
  it("registers with notion:write capability", () => {
    const tool = createNotionCreateTool({ fetch: vi.fn() });
    expect(tool.name).toBe("notion_create");
    expect(tool.capabilities).toEqual([{ name: "notion:write" }]);
  });

  it("calls POST /v1/pages with proper body", async () => {
    const { fetch, calls } = mockNotionFetch([
      { status: 200, body: makePage({ id: "new-page", url: "https://notion.so/new-page" }) },
    ]);
    const tool = createNotionCreateTool({ fetch, token: "test-token" });
    const result = await tool.handler({ databaseId: "db-1", title: "New Page" }, ctx);
    expect(result.pageId).toBe("new-page");
    expect(result.url).toBe("https://notion.so/new-page");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://api.notion.com/v1/pages");
    const body = calls[0].body as Record<string, unknown>;
    expect(body.parent).toEqual({ database_id: "db-1" });
  });
});

describe("notion_update", () => {
  it("registers with notion:write capability", () => {
    const tool = createNotionUpdateTool({ fetch: vi.fn() });
    expect(tool.name).toBe("notion_update");
    expect(tool.capabilities).toEqual([{ name: "notion:write" }]);
  });

  it("calls PATCH /v1/pages/{id}", async () => {
    const { fetch, calls } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const tool = createNotionUpdateTool({ fetch, token: "test-token" });
    const result = await tool.handler(
      { pageId: "page-1", properties: { Status: { select: { name: "Done" } } } },
      ctx,
    );
    expect(result.pageId).toBe("page-1");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://api.notion.com/v1/pages/page-1");
  });

  it("sends archived flag when provided", async () => {
    const { fetch, calls } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const tool = createNotionUpdateTool({ fetch, token: "test-token" });
    await tool.handler({ pageId: "page-1", properties: {}, archived: true }, ctx);
    const body = calls[0].body as Record<string, unknown>;
    expect(body.archived).toBe(true);
  });
});

describe("registerNotionTools", () => {
  it("registers all four notion tools", () => {
    const { fetch } = mockNotionFetch([]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("notion_query");
    expect(names).toContain("notion_get");
    expect(names).toContain("notion_create");
    expect(names).toContain("notion_update");
  });

  it("denies notion_query without notion:read capability", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: { results: [], has_more: false } }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "c1", tool: "notion_query", args: { databaseId: "db-1" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("allows notion_query with notion:read capability", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: { results: [], has_more: false } }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "c2", tool: "notion_query", args: { databaseId: "db-1" } },
      notionReadGrant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("denies notion_create without notion:write capability", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "c3", tool: "notion_create", args: { databaseId: "db-1", title: "Test" } },
      notionReadGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("allows notion_create with notion:write capability", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "c4", tool: "notion_create", args: { databaseId: "db-1", title: "Test" } },
      notionWriteGrant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });
});

describe("error handling", () => {
  it("handles 401 unauthorized", async () => {
    const { fetch } = mockNotionFetch([{ status: 401, body: { message: "unauthorized" } }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "bad-token" });
    const result = await registry.invoke(
      { id: "e1", tool: "notion_get", args: { pageId: "p1" } },
      notionAllGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/);
  });

  it("handles 404 not found", async () => {
    const { fetch } = mockNotionFetch([{ status: 404, body: { message: "not found" } }]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "e2", tool: "notion_get", args: { pageId: "missing" } },
      notionAllGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});
