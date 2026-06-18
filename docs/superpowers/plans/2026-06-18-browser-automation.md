# Browser Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 browser automation tools (browser_navigate, browser_click, browser_screenshot) to the `@openjarvis/skills-web` package using Playwright.

**Architecture:** A `BrowserAutomation` class manages a single Playwright chromium browser instance (lazy-loaded). Tool factory functions accept a `BrowserAutomation` (or mock) instance, following the same dependency-injection pattern as `WebFetchConfig`. Tests use mock `BrowserAutomation` — no real browser launches.

**Tech Stack:** TypeScript, Playwright, Vitest, Zod, `@openjarvis/core`

---

### Task 1: Add Playwright dependencies

**Files:**

- Modify: `packages/skills-web/package.json`

- [ ] **Step 1: Add playwright and @playwright/test to package.json**

In `packages/skills-web/package.json`, add to `dependencies`:

```json
"playwright": "^1.48.0"
```

And add to `devDependencies`:

```json
"@playwright/test": "^1.48.0"
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`

- [ ] **Step 3: Commit**

```bash
git add packages/skills-web/package.json pnpm-lock.yaml
git commit -m "feat(skills-web): add playwright dependencies"
```

---

### Task 2: Create BrowserAutomation class

**Files:**

- Create: `packages/skills-web/src/browser.ts`

- [ ] **Step 1: Write BrowserAutomation class**

Create `packages/skills-web/src/browser.ts`:

```typescript
import type { LaunchOptions } from "playwright";

export interface BrowserAutomation {
  navigate(url: string): Promise<{ title: string; url: string }>;
  click(selector: string): Promise<{ clicked: boolean }>;
  screenshot(): Promise<{ data: string; mimeType: string }>;
  close(): Promise<void>;
}

export class PlaywrightBrowserAutomation implements BrowserAutomation {
  private browser: import("playwright").Browser | undefined;
  private page: import("playwright").Page | undefined;
  private readonly launchOptions: LaunchOptions | undefined;

  constructor(options?: { launchOptions?: LaunchOptions }) {
    this.launchOptions = options?.launchOptions;
  }

  private async ensureBrowser(): Promise<import("playwright").Page> {
    if (!this.browser) {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch(this.launchOptions);
    }
    if (!this.page) {
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
    return this.page;
  }

  async navigate(url: string): Promise<{ title: string; url: string }> {
    const page = await this.ensureBrowser();
    const response = await page.goto(url);
    if (!response) {
      throw new Error(`failed to navigate to ${url}`);
    }
    const title = await page.title();
    return { title, url: page.url() };
  }

  async click(selector: string): Promise<{ clicked: boolean }> {
    const page = await this.ensureBrowser();
    const result = await page.click(selector, { timeout: 5000 });
    return { clicked: result === undefined };
  }

  async screenshot(): Promise<{ data: string; mimeType: string }> {
    const page = await this.ensureBrowser();
    const buffer = await page.screenshot({ type: "png" });
    return { data: buffer.toString("base64"), mimeType: "image/png" };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }
}
```

- [ ] **Step 2: Typecheck to verify**

Run: `pnpm -F @openjarvis/skills-web build`

- [ ] **Step 3: Commit**

```bash
git add packages/skills-web/src/browser.ts
git commit -m "feat(skills-web): add BrowserAutomation class"
```

---

### Task 3: Create browser tool factory functions

**Files:**

- Create: `packages/skills-web/src/browser-tools.ts`

- [ ] **Step 1: Write browser tool factories**

Create `packages/skills-web/src/browser-tools.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck to verify**

Run: `pnpm -F @openjarvis/skills-web build`

- [ ] **Step 3: Commit**

```bash
git add packages/skills-web/src/browser-tools.ts
git commit -m "feat(skills-web): add browser tool factory functions"
```

---

### Task 4: Create browser-tools tests

**Files:**

- Create: `packages/skills-web/test/browser-tools.test.ts`

- [ ] **Step 1: Write the tests**

Create `packages/skills-web/test/browser-tools.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm -F @openjarvis/skills-web test`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/skills-web/test/browser-tools.test.ts
git commit -m "test(skills-web): add browser tool tests"
```

---

### Task 5: Update index.ts exports and export test

**Files:**

- Modify: `packages/skills-web/src/index.ts`
- Modify: `packages/skills-web/test/exports.test.ts`

- [ ] **Step 1: Update src/index.ts**

In `packages/skills-web/src/index.ts`, add the new exports:

```typescript
export { createWebFetchTool, registerWebFetchTools, type WebFetchConfig } from "./fetch.js";
export {
  createBrowserNavigateTool,
  createBrowserClickTool,
  createBrowserScreenshotTool,
  registerBrowserTools,
  type BrowserNavigateArgs,
  type BrowserNavigateResult,
  type BrowserClickArgs,
  type BrowserClickResult,
  type BrowserScreenshotArgs,
  type BrowserScreenshotResult,
} from "./browser-tools.js";
export { PlaywrightBrowserAutomation, type BrowserAutomation } from "./browser.js";
```

- [ ] **Step 2: Update test/exports.test.ts**

In `packages/skills-web/test/exports.test.ts`, add checks for the new exports:

```typescript
import { describe, it, expect } from "vitest";

describe("@openjarvis/skills-web exports", () => {
  it("exports web fetch tools", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createWebFetchTool).toBeTypeOf("function");
    expect(mod.registerWebFetchTools).toBeTypeOf("function");
    expect(mod.WebFetchConfig).toBeUndefined();
  });

  it("exports browser automation tools and types", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createBrowserNavigateTool).toBeTypeOf("function");
    expect(mod.createBrowserClickTool).toBeTypeOf("function");
    expect(mod.createBrowserScreenshotTool).toBeTypeOf("function");
    expect(mod.registerBrowserTools).toBeTypeOf("function");
    expect(mod.PlaywrightBrowserAutomation).toBeTypeOf("function");
  });
});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @openjarvis/skills-web build`

- [ ] **Step 4: Run all tests**

Run: `pnpm -F @openjarvis/skills-web test`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-web/src/index.ts packages/skills-web/test/exports.test.ts
git commit -m "feat(skills-web): export browser automation tools"
```

---

### Task 6: Final verification

- [ ] **Step 1: Typecheck the whole project**

Run: `pnpm -F @openjarvis/skills-web build`

- [ ] **Step 2: Run all tests**

Run: `pnpm -F @openjarvis/skills-web test`

- [ ] **Step 3: Lint check**

Run: `pnpm -F @openjarvis/skills-web lint` (or `pnpm lint` from root if no package-level lint)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(skills-web): address lint/type issues"
```
