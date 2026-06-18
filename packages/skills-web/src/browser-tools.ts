import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolRegistry } from "@openjarvis/core";
import type { BrowserAutomation } from "./browser.js";

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

const BrowserScreenshotArgs = z.object({});

const BrowserScreenshotResult = z.object({
  data: z.string(),
  mimeType: z.string(),
});

export type BrowserScreenshotArgs = z.infer<typeof BrowserScreenshotArgs>;
export type BrowserScreenshotResult = z.infer<typeof BrowserScreenshotResult>;

export function createBrowserNavigateTool(
  browserAutomation: BrowserAutomation,
): ToolDefinition<BrowserNavigateArgs, BrowserNavigateResult> {
  return {
    name: "browser_navigate",
    description: "Navigate the browser to a URL and return the page title and final URL",
    args: BrowserNavigateArgs,
    result: BrowserNavigateResult,
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
    capabilities: [{ name: "web:browse" as const }],
    handler: async (args: BrowserClickArgs, _ctx: ToolContext): Promise<BrowserClickResult> => {
      return browserAutomation.click(args.selector);
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

export function registerBrowserTools(
  registry: ToolRegistry,
  browserAutomation: BrowserAutomation,
): void {
  registry.register(createBrowserNavigateTool(browserAutomation));
  registry.register(createBrowserClickTool(browserAutomation));
  registry.register(createBrowserScreenshotTool(browserAutomation));
}
