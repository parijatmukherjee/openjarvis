import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import type { BrowserAutomation } from "../src/browser.js";
import {
  createBrowserNavigateTool,
  createBrowserClickTool,
  createBrowserScreenshotTool,
  registerBrowserTools,
} from "../src/browser-tools.js";

function createMockBrowserAutomation(): BrowserAutomation {
  return {
    navigate: vi.fn().mockResolvedValue({ title: "Test Page", url: "https://example.com" }),
    click: vi.fn().mockResolvedValue({ clicked: true }),
    screenshot: vi.fn().mockResolvedValue({ data: "iVBORw==", mimeType: "image/png" }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

const ctx = { agentId: "test-agent" };

const webBrowseGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "web:browse" }],
};

describe("browser_navigate", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_navigate");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("browser_navigate");
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("navigates to a URL and returns title and url", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserNavigateTool(browser);
    const result = await tool.handler({ url: "https://example.com" }, ctx);
    expect(result).toEqual({ title: "Test Page", url: "https://example.com" });
    expect(browser.navigate).toHaveBeenCalledWith("https://example.com");
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c1", tool: "browser_navigate", args: { url: "https://example.com" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates navigation errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.navigate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("navigation failed"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c2", tool: "browser_navigate", args: { url: "https://example.com" } },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/navigation failed/);
  });
});

describe("browser_click", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_click");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("clicks an element by selector", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserClickTool(browser);
    const result = await tool.handler({ selector: "#submit-btn" }, ctx);
    expect(result).toEqual({ clicked: true });
    expect(browser.click).toHaveBeenCalledWith("#submit-btn");
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c3", tool: "browser_click", args: { selector: "#btn" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates selector not found errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.click as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("selector not found: #missing"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c4", tool: "browser_click", args: { selector: "#missing" } },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/selector not found/);
  });
});

describe("browser_screenshot", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_screenshot");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("takes a screenshot and returns base64 data", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserScreenshotTool(browser);
    const result = await tool.handler({}, ctx);
    expect(result).toEqual({ data: "iVBORw==", mimeType: "image/png" });
    expect(browser.screenshot).toHaveBeenCalled();
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c5", tool: "browser_screenshot", args: {} },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates screenshot errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.screenshot as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("browser not launched"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c6", tool: "browser_screenshot", args: {} },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/browser not launched/);
  });
});
