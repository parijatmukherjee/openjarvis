import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import { NotionClient } from "../src/notion-client.js";
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

  it("handles has_more false without next_cursor", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [],
          has_more: false,
        },
      },
    ]);
    const tool = createNotionQueryTool({ fetch, token: "test-token" });
    const result = await tool.handler({ databaseId: "db-1" }, ctx);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
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

  it("sends optional properties when provided", async () => {
    const { fetch, calls } = mockNotionFetch([
      { status: 200, body: makePage({ id: "new-page-2" }) },
    ]);
    const tool = createNotionCreateTool({ fetch, token: "test-token" });
    await tool.handler(
      {
        databaseId: "db-1",
        title: "With Props",
        properties: { Status: { select: { name: "Done" } } },
      },
      ctx,
    );
    const body = calls[0].body as Record<string, unknown>;
    const props = body.properties as Record<string, unknown>;
    expect(props.Status).toEqual({ select: { name: "Done" } });
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

  it("handles 429 rate limiting", async () => {
    const { fetch } = mockNotionFetch([
      { status: 429, body: { message: "rate limited" } },
      { status: 429, body: { message: "rate limited" } },
      { status: 429, body: { message: "rate limited" } },
    ]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "e3", tool: "notion_get", args: { pageId: "p1" } },
      notionAllGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate limited/);
  });

  it("handles generic HTTP error with response text", async () => {
    const { fetch } = mockNotionFetch([
      { status: 500, body: { message: "server error" } },
      { status: 500, body: { message: "server error" } },
      { status: 500, body: { message: "server error" } },
    ]);
    const registry = new ToolRegistry();
    registerNotionTools(registry, { fetch, token: "test-token" });
    const result = await registry.invoke(
      { id: "e4", tool: "notion_get", args: { pageId: "p1" } },
      notionAllGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe("NotionClient direct", () => {
  it("creates a page with children", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await client.createPage({
      databaseId: "db-1",
      title: "With Children",
      children: [{ object: "block", type: "paragraph" }],
    });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.children).toEqual([{ object: "block", type: "paragraph" }]);
  });

  it("updatePage sends archived flag", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await client.updatePage({
      pageId: "page-1",
      properties: { Status: { select: { name: "Done" } } },
      archived: true,
    });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.archived).toBe(true);
  });

  it("queryDatabase sends empty body when no filter/sorts/limit", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: { results: [], has_more: false } }]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await client.queryDatabase("db-1");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(Object.keys(body)).toHaveLength(0);
  });

  it("uses default token from NOTION_TOKEN env var", () => {
    const original = process.env.NOTION_TOKEN;
    process.env.NOTION_TOKEN = "env-token";
    const client = new NotionClient({ fetch: vi.fn() });
    process.env.NOTION_TOKEN = original;
    expect(client).toBeDefined();
  });

  it("uses custom timeout", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: { results: [], has_more: false } }]);
    const client = new NotionClient({ fetch, token: "test-token", timeoutMs: 5000 });
    const result = await client.queryDatabase("db-1");
    expect(result.results).toEqual([]);
  });

  it("handles page with null title property gracefully", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [
            {
              id: "p1",
              url: "https://notion.so/p1",
              created_time: "2026-01-01T00:00:00Z",
              last_edited_time: "2026-01-02T00:00:00Z",
              properties: {},
            },
          ],
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.results[0].title).toBe("");
  });

  it("handles page with Name property as null", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [
            {
              id: "p2",
              url: "https://notion.so/p2",
              created_time: "2026-01-01T00:00:00Z",
              last_edited_time: "2026-01-02T00:00:00Z",
              properties: { Name: null },
            },
          ],
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.results[0].title).toBe("");
  });

  it("handles has_more false without next_cursor", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [],
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it("handles has_more true with null next_cursor", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [makePage()],
          has_more: true,
          next_cursor: null,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeUndefined();
  });

  it("handles page with title property containing text", async () => {
    const { fetch } = mockNotionFetch([{ status: 200, body: makePage() }]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.getPage("page-1");
    expect(result.title).toBe("Test Page");
  });

  it("handles page with name property (lowercase) instead of Name", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [
            {
              id: "p3",
              url: "https://notion.so/p3",
              created_time: "2026-01-01T00:00:00Z",
              last_edited_time: "2026-01-02T00:00:00Z",
              properties: { name: { title: [{ plain_text: "Lowercase Name" }] } },
            },
          ],
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.results[0].title).toBe("Lowercase Name");
  });

  it("handles page with title property instead of Name", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: [
            {
              id: "p4",
              url: "https://notion.so/p4",
              created_time: "2026-01-01T00:00:00Z",
              last_edited_time: "2026-01-02T00:00:00Z",
              properties: { title: { title: [{ plain_text: "Title Prop" }] } },
            },
          ],
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.results[0].title).toBe("Title Prop");
  });

  it("handles query result with non-array results", async () => {
    const { fetch } = mockNotionFetch([
      {
        status: 200,
        body: {
          results: null,
          has_more: false,
        },
      },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    const result = await client.queryDatabase("db-1");
    expect(result.results).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("handles 401 unauthorized error", async () => {
    const { fetch } = mockNotionFetch([{ status: 401, body: { message: "unauthorized" } }]);
    const client = new NotionClient({ fetch, token: "bad-token" });
    await expect(client.getPage("p1")).rejects.toThrow("unauthorized");
  });

  it("handles 404 not found error", async () => {
    const { fetch } = mockNotionFetch([{ status: 404, body: { message: "not found" } }]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await expect(client.getPage("missing")).rejects.toThrow("not found");
  });

  it("handles 429 rate limited error", async () => {
    const { fetch } = mockNotionFetch([
      { status: 429, body: { message: "rate limited" } },
      { status: 429, body: { message: "rate limited" } },
      { status: 429, body: { message: "rate limited" } },
    ]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await expect(client.getPage("p1")).rejects.toThrow("rate limited");
  });

  it("handles generic HTTP error with fallback text", async () => {
    const responses = [
      {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
        text: async () => "Internal Server Error",
      },
      {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
        text: async () => "Internal Server Error",
      },
      {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
        text: async () => "Internal Server Error",
      },
    ];
    let callIdx = 0;
    const fetch = vi.fn().mockImplementation(async () => responses[callIdx++]);
    const client = new NotionClient({ fetch, token: "test-token" });
    await expect(client.getPage("p1")).rejects.toThrow("HTTP 500");
  });
});
