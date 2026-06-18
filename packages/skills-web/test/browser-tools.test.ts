import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import type { BrowserAutomation } from "../src/browser.js";
import {
  createBrowserNavigateTool,
  createBrowserClickTool,
  createBrowserTypeTool,
  createBrowserScreenshotTool,
  createBrowserAccessibilityTool,
  createBrowserListTabsTool,
  createBrowserSwitchTabTool,
  createBrowserCloseTabTool,
  registerBrowserTools,
} from "../src/browser-tools.js";

function createMockBrowserAutomation(): BrowserAutomation {
  return {
    navigate: vi.fn().mockResolvedValue({ title: "Test Page", url: "https://example.com" }),
    click: vi.fn().mockResolvedValue({ clicked: true }),
    type: vi.fn().mockResolvedValue({ typed: true }),
    screenshot: vi.fn().mockResolvedValue({ data: "iVBORw==", mimeType: "image/png" }),
    accessibility: vi.fn().mockResolvedValue({
      role: "WebArea",
      name: "Test Page",
      children: [{ role: "button", name: "Submit" }],
    }),
    getCookies: vi.fn().mockResolvedValue([]),
    setCookies: vi.fn().mockResolvedValue(undefined),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    listTabs: vi.fn().mockResolvedValue([{ id: "tab-1", url: "https://example.com", title: "Test Page" }]),
    switchTab: vi.fn().mockResolvedValue(undefined),
    closeTab: vi.fn().mockResolvedValue(undefined),
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

describe("browser_type", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_type");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("types text into an element by selector", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserTypeTool(browser);
    const result = await tool.handler({ selector: "#search-input", text: "hello world" }, ctx);
    expect(result).toEqual({ typed: true });
    expect(browser.type).toHaveBeenCalledWith("#search-input", "hello world");
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c5", tool: "browser_type", args: { selector: "#input", text: "test" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates type errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.type as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("selector not found: #missing-input"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c6", tool: "browser_type", args: { selector: "#missing-input", text: "test" } },
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
      { id: "c7", tool: "browser_screenshot", args: {} },
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
      { id: "c8", tool: "browser_screenshot", args: {} },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/browser not launched/);
  });
});

describe("browser_accessibility", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_accessibility");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("extracts the accessibility tree", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserAccessibilityTool(browser);
    const result = await tool.handler({}, ctx);
    expect(result.role).toBe("WebArea");
    expect(result.name).toBe("Test Page");
    expect(result.children).toEqual([{ role: "button", name: "Submit" }]);
    expect(browser.accessibility).toHaveBeenCalled();
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c9", tool: "browser_accessibility", args: {} },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates accessibility errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.accessibility as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("accessibility snapshot failed"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c10", tool: "browser_accessibility", args: {} },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/accessibility snapshot failed/);
  });
});

describe("browser_list_tabs", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_list_tabs");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("lists open tabs", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserListTabsTool(browser);
    const result = await tool.handler({}, ctx);
    expect(result).toEqual([{ id: "tab-1", url: "https://example.com", title: "Test Page" }]);
    expect(browser.listTabs).toHaveBeenCalled();
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c11", tool: "browser_list_tabs", args: {} },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });
});

describe("browser_switch_tab", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_switch_tab");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("switches to a tab by ID", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserSwitchTabTool(browser);
    const result = await tool.handler({ tabId: "tab-1" }, ctx);
    expect(result).toEqual({ switched: true });
    expect(browser.switchTab).toHaveBeenCalledWith("tab-1");
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c12", tool: "browser_switch_tab", args: { tabId: "tab-1" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates switch tab errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.switchTab as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("tab not found: missing-tab"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c13", tool: "browser_switch_tab", args: { tabId: "missing-tab" } },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tab not found/);
  });
});

describe("browser_close_tab", () => {
  it("registers with web:browse capability", () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const tool = registry.get("browser_close_tab");
    expect(tool).toBeDefined();
    expect(tool!.capabilities).toEqual([{ name: "web:browse" }]);
  });

  it("closes a tab by ID", async () => {
    const browser = createMockBrowserAutomation();
    const tool = createBrowserCloseTabTool(browser);
    const result = await tool.handler({ tabId: "tab-1" }, ctx);
    expect(result).toEqual({ closed: true });
    expect(browser.closeTab).toHaveBeenCalledWith("tab-1");
  });

  it("is denied without web:browse capability", async () => {
    const registry = new ToolRegistry();
    const browser = createMockBrowserAutomation();
    registerBrowserTools(registry, browser);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c14", tool: "browser_close_tab", args: { tabId: "tab-1" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("propagates close tab errors", async () => {
    const browser = createMockBrowserAutomation();
    (browser.closeTab as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("tab not found: missing-tab"),
    );
    const registry = new ToolRegistry();
    registerBrowserTools(registry, browser);
    const res = await registry.invoke(
      { id: "c15", tool: "browser_close_tab", args: { tabId: "missing-tab" } },
      webBrowseGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tab not found/);
  });
});