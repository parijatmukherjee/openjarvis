import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolRegistry } from "@openjarvis/core";
import type { BrowserAutomation, AccessibilityNode, TabInfo } from "./browser.js";

function mapAccessibilityNode(node: AccessibilityNode): BrowserAccessibilityResult {
  return {
    role: node.role,
    name: node.name,
    value: node.value,
    description: node.description,
    children: node.children?.map(mapAccessibilityNode),
  };
}

const BrowserNavigateArgs = z.object({
  url: z.string().url(),
});

const BrowserNavigateResult = z.object({
  title: z.string(),
  url: z.string(),
});

export type BrowserNavigateArgs = z.infer<typeof BrowserNavigateArgs>;
export type BrowserNavigateResult = z.infer<typeof BrowserNavigateResult>;

const BrowserClickArgs = z.object({
  selector: z.string().min(1),
});

const BrowserClickResult = z.object({
  clicked: z.boolean(),
});

export type BrowserClickArgs = z.infer<typeof BrowserClickArgs>;
export type BrowserClickResult = z.infer<typeof BrowserClickResult>;

const BrowserTypeArgs = z.object({
  selector: z.string().min(1),
  text: z.string(),
});

const BrowserTypeResult = z.object({
  typed: z.boolean(),
});

export type BrowserTypeArgs = z.infer<typeof BrowserTypeArgs>;
export type BrowserTypeResult = z.infer<typeof BrowserTypeResult>;

const BrowserScreenshotArgs = z.object({});

const BrowserScreenshotResult = z.object({
  data: z.string(),
  mimeType: z.string(),
});

export type BrowserScreenshotArgs = z.infer<typeof BrowserScreenshotArgs>;
export type BrowserScreenshotResult = z.infer<typeof BrowserScreenshotResult>;

const AccessibilityNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(
  (): z.ZodType<Record<string, unknown>> =>
    z.object({
      role: z.string(),
      name: z.string().optional(),
      value: z.string().optional(),
      description: z.string().optional(),
      children: z.array(AccessibilityNodeSchema).optional(),
    }),
);

const BrowserAccessibilityArgs = z.object({});

const BrowserAccessibilityResult = z.object({
  role: z.string(),
  name: z.string().optional(),
  value: z.string().optional(),
  description: z.string().optional(),
  children: z.array(AccessibilityNodeSchema).optional(),
});

export type BrowserAccessibilityArgs = z.infer<typeof BrowserAccessibilityArgs>;
export type BrowserAccessibilityResult = z.infer<typeof BrowserAccessibilityResult>;

const BrowserListTabsArgs = z.object({});

const BrowserListTabsResult = z.array(
  z.object({
    id: z.string(),
    url: z.string(),
    title: z.string(),
  }),
);

const BrowserSwitchTabArgs = z.object({
  tabId: z.string().min(1),
});

const BrowserSwitchTabResult = z.object({
  switched: z.boolean(),
});

export type BrowserSwitchTabArgs = z.infer<typeof BrowserSwitchTabArgs>;
export type BrowserSwitchTabResult = z.infer<typeof BrowserSwitchTabResult>;

const BrowserCloseTabArgs = z.object({
  tabId: z.string().min(1),
});

const BrowserCloseTabResult = z.object({
  closed: z.boolean(),
});

export type BrowserCloseTabArgs = z.infer<typeof BrowserCloseTabArgs>;
export type BrowserCloseTabResult = z.infer<typeof BrowserCloseTabResult>;

export function createBrowserNavigateTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserNavigateArgs, BrowserNavigateResult> {
  return {
    name: "browser_navigate",
    description: "Navigate the browser to a URL and return the page title and final URL",
    args: BrowserNavigateArgs,
    result: BrowserNavigateResult,
    approvalRequired: true,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      args: BrowserNavigateArgs,
      _ctx: ToolContext,
    ): Promise<BrowserNavigateResult> => {
      return browserAutomation.navigate(args.url);
    },
  };
}

export function createBrowserClickTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserClickArgs, BrowserClickResult> {
  return {
    name: "browser_click",
    description: "Click an element in the browser by CSS selector",
    args: BrowserClickArgs,
    result: BrowserClickResult,
    approvalRequired: true,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (args: BrowserClickArgs, _ctx: ToolContext): Promise<BrowserClickResult> => {
      return browserAutomation.click(args.selector);
    },
  };
}

export function createBrowserTypeTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserTypeArgs, BrowserTypeResult> {
  return {
    name: "browser_type",
    description: "Type text into an element in the browser by CSS selector",
    args: BrowserTypeArgs,
    result: BrowserTypeResult,
    approvalRequired: true,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (args: BrowserTypeArgs, _ctx: ToolContext): Promise<BrowserTypeResult> => {
      return browserAutomation.type(args.selector, args.text);
    },
  };
}

export function createBrowserScreenshotTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserScreenshotArgs, BrowserScreenshotResult> {
  return {
    name: "browser_screenshot",
    description: "Take a screenshot of the current browser page and return it as base64 PNG",
    args: BrowserScreenshotArgs,
    result: BrowserScreenshotResult,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      _args: BrowserScreenshotArgs,
      _ctx: ToolContext,
    ): Promise<BrowserScreenshotResult> => {
      return browserAutomation.screenshot();
    },
  };
}

export function createBrowserAccessibilityTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserAccessibilityArgs, BrowserAccessibilityResult> {
  return {
    name: "browser_accessibility",
    description: "Extract the accessibility tree of the current browser page",
    args: BrowserAccessibilityArgs,
    result: BrowserAccessibilityResult,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      _args: BrowserAccessibilityArgs,
      _ctx: ToolContext,
    ): Promise<BrowserAccessibilityResult> => {
      const node = await browserAutomation.accessibility();
      return mapAccessibilityNode(node);
    },
  };
}

export function createBrowserListTabsTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<z.infer<typeof BrowserListTabsArgs>, TabInfo[]> {
  return {
    name: "browser_list_tabs",
    description: "List all open browser tabs",
    args: BrowserListTabsArgs,
    result: BrowserListTabsResult,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      _args: z.infer<typeof BrowserListTabsArgs>,
      _ctx: ToolContext,
    ): Promise<TabInfo[]> => {
      return browserAutomation.listTabs();
    },
  };
}

export function createBrowserSwitchTabTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserSwitchTabArgs, BrowserSwitchTabResult> {
  return {
    name: "browser_switch_tab",
    description: "Switch to a browser tab by its ID",
    args: BrowserSwitchTabArgs,
    result: BrowserSwitchTabResult,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      args: BrowserSwitchTabArgs,
      _ctx: ToolContext,
    ): Promise<BrowserSwitchTabResult> => {
      await browserAutomation.switchTab(args.tabId);
      return { switched: true };
    },
  };
}

export function createBrowserCloseTabTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserCloseTabArgs, BrowserCloseTabResult> {
  return {
    name: "browser_close_tab",
    description: "Close a browser tab by its ID",
    args: BrowserCloseTabArgs,
    result: BrowserCloseTabResult,
    approvalRequired: true,
    capabilities: [{ name: "web:browse" as const }],
    handler: async (
      args: BrowserCloseTabArgs,
      _ctx: ToolContext,
    ): Promise<BrowserCloseTabResult> => {
      await browserAutomation.closeTab(args.tabId);
      return { closed: true };
    },
  };
}

export function registerBrowserTools(
  registry: ToolRegistry,
  browserAutomation: BrowserAutomation,
): void {
  registry.register(createBrowserNavigateTool(browserAutomation));
  registry.register(createBrowserClickTool(browserAutomation));
  registry.register(createBrowserTypeTool(browserAutomation));
  registry.register(createBrowserScreenshotTool(browserAutomation));
  registry.register(createBrowserAccessibilityTool(browserAutomation));
  registry.register(createBrowserListTabsTool(browserAutomation));
  registry.register(createBrowserSwitchTabTool(browserAutomation));
  registry.register(createBrowserCloseTabTool(browserAutomation));
}
