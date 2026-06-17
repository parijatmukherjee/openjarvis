import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import { createWebFetchTool, registerWebFetchTools } from "../src/fetch.js";
import type { AgentGrant } from "@openjarvis/core";

vi.mock("@openjarvis/markdownify", () => ({
  markdownify: vi.fn().mockResolvedValue({
    markdown: "Hello World",
    format: "html",
    warnings: [],
    title: "Test",
  }),
}));

import { markdownify } from "@openjarvis/markdownify";

const mockMarkdownify = vi.mocked(markdownify);

const ctx = { agentId: "test-agent" };
const webFetchGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "web:fetch" }, { name: "document:convert" }],
};

function mockFetch(body: string, status = 200, contentType = "text/html") {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: () => new TextEncoder().encode(body).buffer,
  });
}

describe("web_fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkdownify.mockResolvedValue({
      markdown: "Hello World",
      format: "html",
      warnings: [],
      title: "Test",
    });
  });

  it("registers web_fetch with network capability", () => {
    const registry = new ToolRegistry();
    registerWebFetchTools(registry, { fetch: mockFetch("<html></html>") });
    const tool = registry.get("web_fetch");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("web_fetch");
    expect(tool!.capabilities).toEqual([{ name: "web:fetch" }, { name: "document:convert" }]);
  });

  it("fetches a URL and returns markdown content", async () => {
    const fetchMock = mockFetch("<html><body>Hello</body></html>");
    const tool = createWebFetchTool({ fetch: fetchMock });
    const result = await tool.handler({ url: "https://example.com", format: "markdown" }, ctx);
    expect(result.markdown).toBe("Hello World");
    expect(result.title).toBe("Test");
    expect(result.url).toBe("https://example.com");
    expect(result.format).toBe("html");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", expect.any(Object));
  });

  it("is denied without web:fetch capability", async () => {
    const fetchMock = mockFetch("<html></html>");
    const registry = new ToolRegistry();
    registerWebFetchTools(registry, { fetch: fetchMock });
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c1", tool: "web_fetch", args: { url: "https://example.com", format: "markdown" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("returns error for non-2xx responses", async () => {
    const fetchMock = mockFetch("Not Found", 404);
    const registry = new ToolRegistry();
    registerWebFetchTools(registry, { fetch: fetchMock });
    const res = await registry.invoke(
      { id: "c2", tool: "web_fetch", args: { url: "https://example.com", format: "markdown" } },
      webFetchGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 404/);
  });

  it("handles network errors gracefully", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    const registry = new ToolRegistry();
    registerWebFetchTools(registry, { fetch: fetchMock });
    const res = await registry.invoke(
      { id: "c3", tool: "web_fetch", args: { url: "https://example.com", format: "markdown" } },
      webFetchGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Network error/);
  });
});
