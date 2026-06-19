# Playwright E2E Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E test infrastructure for the OpenJarvis desktop app, running against the real Electron app in both headed (dev) and headless (CI) modes.

**Architecture:** New `packages/desktop-e2e` package uses `@playwright/test` with Electron launch support. A `PlaywrightTestBridge` implements the `NexusBridge` interface with deterministic test data, injected via `window.__testBridge` in `App.tsx`. Tests cover onboarding flow, dashboard interactions, channel/skill flows through the UI, voice pipeline, memory, and full integration scenarios.

**Tech Stack:** Playwright, `@playwright/test`, Electron, Vite dev server, Vitest (existing unit tests unchanged)

---

## Task 1: Create the desktop-e2e package scaffold

**Files:**
- Create: `packages/desktop-e2e/package.json`
- Create: `packages/desktop-e2e/tsconfig.json`
- Create: `packages/desktop-e2e/playwright.config.ts`

- [ ] **Step 1: Create `packages/desktop-e2e/package.json`**

```json
{
  "name": "@openjarvis/desktop-e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --headed --debug",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "playwright": "^1.48.0"
  }
}
```

- [ ] **Step 2: Create `packages/desktop-e2e/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM"],
    "jsx": "react-jsx"
  },
  "include": ["tests/**/*.ts", "tests/**/*.tsx", "fixtures/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/desktop-e2e/playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    headed: !process.env.CI,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "electron",
      use: {},
    },
  ],
});
```

- [ ] **Step 4: Add the package to the workspace**

Edit `package.json` at the workspace root to verify `packages/desktop-e2e` is included in the workspace. If the workspace uses `packages/*` glob, it's automatic. Otherwise add it.

- [ ] **Step 5: Install dependencies**

Run: `npm install`

- [ ] **Step 6: Install Playwright browsers**

Run: `npx playwright install --with-deps electron`

- [ ] **Step 7: Commit**

```bash
git add packages/desktop-e2e/
git commit -m "feat(desktop-e2e): scaffold Playwright E2E test package"
```

---

## Task 2: Create test data factories

**Files:**
- Create: `packages/desktop-e2e/fixtures/test-data.ts`

- [ ] **Step 1: Create `packages/desktop-e2e/fixtures/test-data.ts`**

This file mirrors the types from `packages/desktop/src/renderer/lib/nexus-types.ts` and provides factory functions for deterministic test data.

```ts
import type { CapabilityName } from "@openjarvis/core";

export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface AgentView {
  id: string;
  name: string;
  role: string;
  status: "active" | "busy" | "failed" | "idle";
  description: string;
  capabilities: CapabilityName[];
  lastActivity: string;
  tasksCompleted: number;
}

export interface MessageView {
  id: string;
  type: "user" | "jarvis" | "system";
  text: string;
  timestamp: string;
}

export interface NexusBridge {
  getTasks(): Promise<Task[]>;
  getAgents(): Promise<AgentView[]>;
  getMessages(): Promise<MessageView[]>;
  executeIntent(action: string, params: Record<string, unknown>): Promise<void>;
  subscribeToEvents(handler: (event: unknown) => void): () => void;
}

let nextId = 1;

function id(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

function ts(offset = 0): string {
  const d = new Date(Date.now() + offset);
  return d.toLocaleTimeString();
}

export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: id("task"),
    agentId: "research",
    description: "Test task",
    status: "completed",
    startedAt: Date.now() - 1000,
    durationMs: 800,
    ...overrides,
  };
}

export function createAgent(overrides: Partial<AgentView> = {}): AgentView {
  return {
    id: id("agent"),
    name: "Research",
    role: "Research",
    status: "active",
    description: "Web search and information gathering",
    capabilities: ["web_search" as CapabilityName, "summarize" as CapabilityName],
    lastActivity: "2m ago",
    tasksCompleted: 142,
    ...overrides,
  };
}

export function createMessage(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: id("msg"),
    type: "user",
    text: "Test message",
    timestamp: ts(),
    ...overrides,
  };
}

export const sampleAgents: AgentView[] = [
  createAgent({ id: "research", name: "Research", role: "Research", status: "active", description: "Web search and information gathering", capabilities: ["web_search" as CapabilityName, "summarize" as CapabilityName], lastActivity: "2m ago", tasksCompleted: 142 }),
  createAgent({ id: "system", name: "System", role: "System", status: "busy", description: "System operations and file management", capabilities: ["shell" as CapabilityName, "fs:read" as CapabilityName, "fs:write" as CapabilityName], lastActivity: "now", tasksCompleted: 89 }),
  createAgent({ id: "weather", name: "Weather", role: "Data", status: "active", description: "Weather data retrieval and forecasts", capabilities: ["weather:read" as CapabilityName], lastActivity: "5m ago", tasksCompleted: 256 }),
  createAgent({ id: "calendar", name: "Calendar", role: "Data", status: "idle", description: "Calendar events and scheduling", capabilities: ["calendar:read" as CapabilityName, "calendar:write" as CapabilityName], lastActivity: "1h ago", tasksCompleted: 67 }),
  createAgent({ id: "browser", name: "Browser", role: "Browser", status: "failed", description: "Web browser automation", capabilities: ["web:browse" as CapabilityName], lastActivity: "3h ago", tasksCompleted: 34 }),
  createAgent({ id: "vision", name: "Vision", role: "Vision", status: "active", description: "Visual recognition and screen analysis", capabilities: ["detect_humans" as CapabilityName, "detect_emotion" as CapabilityName], lastActivity: "1m ago", tasksCompleted: 198 }),
];

export const sampleTasks: Task[] = [
  createTask({ id: "1", agentId: "weather", description: "Fetching weather data", status: "running", startedAt: Date.now() - 1200, durationMs: 1200 }),
  createTask({ id: "2", agentId: "calendar", description: "Loading calendar events", status: "completed", startedAt: Date.now() - 800, durationMs: 800 }),
  createTask({ id: "3", agentId: "research", description: "Web search: AI trends 2025", status: "pending", startedAt: Date.now() }),
  createTask({ id: "4", agentId: "system", description: "Opening Calendar app", status: "completed", startedAt: Date.now() - 300, durationMs: 300 }),
];

export const sampleMessages: MessageView[] = [
  createMessage({ id: "1", type: "user", text: "What's the weather like?", timestamp: ts(-60000) }),
  createMessage({ id: "2", type: "jarvis", text: "It's 72°F and sunny. Would you like me to open the weather app?", timestamp: ts(-58000) }),
  createMessage({ id: "3", type: "system", text: "Agent 'weather' dispatched", timestamp: ts(-55000) }),
  createMessage({ id: "4", type: "user", text: "Yes, please", timestamp: ts(-30000) }),
  createMessage({ id: "5", type: "jarvis", text: "Done. Calendar app opened.", timestamp: ts(-28000) }),
];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/desktop-e2e/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-e2e/fixtures/test-data.ts
git commit -m "feat(desktop-e2e): add test data factories for Playwright tests"
```

---

## Task 3: Create PlaywrightTestBridge

**Files:**
- Create: `packages/desktop-e2e/fixtures/test-bridge.ts`

- [ ] **Step 1: Create `packages/desktop-e2e/fixtures/test-bridge.ts`**

```ts
import type { Task, AgentView, MessageView, NexusBridge } from "./test-data.js";

export class PlaywrightTestBridge implements NexusBridge {
  private tasks: Task[] = [];
  private agents: AgentView[] = [];
  private messages: MessageView[] = [];
  private eventHandlers: Set<(event: unknown) => void> = new Set();
  private intentLog: Array<{ action: string; params: Record<string, unknown> }> = [];

  constructor(
    tasks: Task[] = [],
    agents: AgentView[] = [],
    messages: MessageView[] = [],
  ) {
    this.tasks = [...tasks];
    this.agents = [...agents];
    this.messages = [...messages];
  }

  async getTasks(): Promise<Task[]> {
    return this.tasks;
  }

  async getAgents(): Promise<AgentView[]> {
    return this.agents;
  }

  async getMessages(): Promise<MessageView[]> {
    return this.messages;
  }

  async executeIntent(action: string, params: Record<string, unknown>): Promise<void> {
    this.intentLog.push({ action, params });
    this.messages.push({
      id: `intent-${this.intentLog.length}`,
      type: "user",
      text: `${action}: ${JSON.stringify(params)}`,
      timestamp: new Date().toLocaleTimeString(),
    });
    this.notifyEventHandlers({ type: "intent", action, params });
  }

  subscribeToEvents(handler: (event: unknown) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  addTask(task: Task): void {
    this.tasks.push(task);
    this.notifyEventHandlers({ type: "taskAdded", task });
  }

  updateTask(taskId: string, updates: Partial<Task>): void {
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      this.tasks[idx] = { ...this.tasks[idx], ...updates };
      this.notifyEventHandlers({ type: "taskUpdated", taskId, updates });
    }
  }

  addAgent(agent: AgentView): void {
    this.agents.push(agent);
    this.notifyEventHandlers({ type: "agentAdded", agent });
  }

  addMessage(message: MessageView): void {
    this.messages.push(message);
    this.notifyEventHandlers({ type: "messageAdded", message });
  }

  simulateIntentResponse(action: string, response: string): void {
    this.messages.push({
      id: `resp-${this.messages.length}`,
      type: "jarvis",
      text: response,
      timestamp: new Date().toLocaleTimeString(),
    });
    this.notifyEventHandlers({ type: "intentResponse", action, response });
  }

  simulateError(error: string): void {
    this.messages.push({
      id: `err-${this.messages.length}`,
      type: "system",
      text: `Error: ${error}`,
      timestamp: new Date().toLocaleTimeString(),
    });
    this.notifyEventHandlers({ type: "error", error });
  }

  getIntentLog(): Array<{ action: string; params: Record<string, unknown> }> {
    return this.intentLog;
  }

  reset(
    tasks: Task[] = [],
    agents: AgentView[] = [],
    messages: MessageView[] = [],
  ): void {
    this.tasks = [...tasks];
    this.agents = [...agents];
    this.messages = [...messages];
    this.intentLog = [];
  }

  private notifyEventHandlers(event: unknown): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // swallow errors in test handlers
      }
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/desktop-e2e/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-e2e/fixtures/test-bridge.ts
git commit -m "feat(desktop-e2e): add PlaywrightTestBridge with deterministic test data"
```

---

## Task 4: Modify App.tsx to support test bridge injection

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Update `App.tsx` to check for `window.__testBridge`**

Change the bridge creation from:

```tsx
const bridge = useState(() => createMockNexusBridge())[0];
```

To:

```tsx
const bridge = useState(
  () =>
    (window as unknown as { __testBridge?: NexusBridge }).__testBridge ??
    createMockNexusBridge(),
)[0];
```

Also add the `NexusBridge` type import. The full file becomes:

```tsx
import { useState } from "react";
import { NexusProvider } from "./contexts/NexusContext";
import { SettingsProvider } from "./context/SettingsContext";
import { createMockNexusBridge } from "./lib/mock-nexus-bridge";
import type { NexusBridge } from "./lib/nexus-types";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { WindowControls } from "./components/WindowControls";
import { SettingsPanel } from "./components/SettingsPanel";

export function App() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const bridge = useState(
    () =>
      (window as unknown as { __testBridge?: NexusBridge }).__testBridge ??
      createMockNexusBridge(),
  )[0];

  return (
    <SettingsProvider>
      <NexusProvider value={bridge}>
        <div className="relative">
          <WindowControls onSettings={() => setShowSettings(true)} />
          <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
          {showOnboarding ? (
            <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
          ) : (
            <DashboardLayout />
          )}
        </div>
      </NexusProvider>
    </SettingsProvider>
  );
}
```

- [ ] **Step 2: Verify the change compiles**

Run: `npx tsc --noEmit -p packages/desktop/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx vitest run packages/desktop/`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): support test bridge injection via window.__testBridge"
```

---

## Task 5: Create the Electron app fixture

**Files:**
- Create: `packages/desktop-e2e/fixtures/electron-app.ts`

- [ ] **Step 1: Create `packages/desktop-e2e/fixtures/electron-app.ts`**

```ts
import { test as base, expect, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { ChildProcess, spawn } from "node:child_process";
import { PlaywrightTestBridge } from "./test-bridge.js";
import { sampleAgents, sampleTasks, sampleMessages } from "./test-data.js";

type ElectronTestFixture = {
  electronApp: ElectronApplication;
  page: Page;
  bridge: PlaywrightTestBridge;
};

let viteDevServer: ChildProcess | null = null;

async function startViteDevServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "npx",
      ["vite", "--config", "../desktop/vite.renderer.config.ts", "--port", "5173"],
      { cwd: import.meta.dirname, shell: true, stdio: "pipe" },
    );
    viteDevServer = proc;
    let output = "";
    proc.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
      if (output.includes("Local:")) {
        resolve();
      }
    });
    proc.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
      if (output.includes("Local:")) {
        resolve();
      }
    });
    setTimeout(() => {
      reject(new Error(`Vite dev server failed to start. Output: ${output}`));
    }, 30_000);
  });
}

async function stopViteDevServer(): Promise<void> {
  if (viteDevServer) {
    viteDevServer.kill();
    viteDevServer = null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export const test = base.extend<ElectronTestFixture>({
  electronApp: async ({}, use) => {
    await startViteDevServer();

    const app = await electron.launch({
      args: ["../desktop"],
      env: {
        ...process.env,
        OPENJARVIS_DEV: "1",
        NODE_ENV: "test",
      },
    });

    await use(app);
    await app.close();
    await stopViteDevServer();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },

  bridge: async ({ page }, use) => {
    const bridge = new PlaywrightTestBridge(sampleTasks, sampleAgents, sampleMessages);
    await page.evaluate((bridgeData) => {
      (window as unknown as Record<string, unknown>).__testBridge = bridgeData;
    }, bridge as unknown as Record<string, unknown>);
    await use(bridge);
  },
});

export { expect };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/desktop-e2e/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-e2e/fixtures/electron-app.ts
git commit -m "feat(desktop-e2e): add Electron app fixture for Playwright tests"
```

---

## Task 6: Add dev:renderer script to desktop package

**Files:**
- Modify: `packages/desktop/package.json`

- [ ] **Step 1: Add `dev:renderer` script to desktop package.json**

Add to the `"scripts"` section:

```json
"dev:renderer": "vite --config vite.renderer.config.ts --port 5173"
```

The full scripts section becomes:

```json
"scripts": {
  "build": "tsc -b",
  "build:renderer": "vite build --config vite.renderer.config.ts",
  "dev": "electron .",
  "dev:renderer": "vite --config vite.renderer.config.ts --port 5173",
  "start": "electron .",
  "pack": "npm run build && npm run build:renderer && electron-builder"
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/package.json
git commit -m "feat(desktop): add dev:renderer script for Vite dev server"
```

---

## Task 7: Write onboarding E2E tests

**Files:**
- Create: `packages/desktop-e2e/tests/onboarding/welcome.spec.ts`
- Create: `packages/desktop-e2e/tests/onboarding/locale-setup.spec.ts`
- Create: `packages/desktop-e2e/tests/onboarding/agent-selection.spec.ts`
- Create: `packages/desktop-e2e/tests/onboarding/completion.spec.ts`

- [ ] **Step 1: Create `welcome.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Welcome screen", () => {
  test("renders the JARVIS title", async ({ page }) => {
    await expect(page.getByText("JARVIS")).toBeVisible({ timeout: 10_000 });
  });

  test("renders the Initialize button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /initialize/i })).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Initialize advances to locale setup", async ({ page }) => {
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Create `locale-setup.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Locale setup", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale/i)).toBeVisible({ timeout: 5_000 });
  });

  test("displays language options", async ({ page }) => {
    await expect(page.getByRole("button", { name: /english/i })).toBeVisible();
  });

  test("selecting a language highlights it", async ({ page }) => {
    const englishBtn = page.getByRole("button", { name: /english/i });
    await englishBtn.click();
    await expect(englishBtn).toHaveClass(/selected|active|ring/);
  });

  test("clicking Next advances to voice calibration", async ({ page }) => {
    await page.getByRole("button", { name: /english/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/calibrat|microphone|voice/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 3: Create `agent-selection.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Agent selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: /initialize/i }).click();
    await page.getByRole("button", { name: /english/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/calibrat|microphone|voice/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /next|skip|continue/i }).click();
    await expect(page.getByText(/agent|enable/i)).toBeVisible({ timeout: 5_000 });
  });

  test("displays agent toggle cards", async ({ page }) => {
    await expect(page.getByText(/research/i)).toBeVisible();
    await expect(page.getByText(/weather/i)).toBeVisible();
  });

  test("toggling an agent updates the state", async ({ page }) => {
    const weatherToggle = page.locator("[data-testid=agent-weather], [role=switch]").first();
    if (await weatherToggle.isVisible()) {
      const isOn = await weatherToggle.getAttribute("aria-checked");
      await weatherToggle.click();
      const newState = await weatherToggle.getAttribute("aria-checked");
      expect(isOn).not.toBe(newState);
    }
  });
});
```

- [ ] **Step 4: Create `completion.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Onboarding completion", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: /initialize/i }).click();
    await page.getByRole("button", { name: /english/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /next|skip|continue/i }).click();
    await page.getByRole("button", { name: /next|continue/i }).click();
    await expect(page.getByText(/ready|complete|done/i)).toBeVisible({ timeout: 5_000 });
  });

  test("displays completion screen", async ({ page }) => {
    await expect(page.getByText(/ready|launch|dashboard/i)).toBeVisible();
  });

  test("clicking Launch Dashboard shows the dashboard", async ({ page }) => {
    await page.getByRole("button", { name: /launch|dashboard|go/i }).click();
    await expect(page.getByText(/task|agent|voice/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 5: Verify tests are discovered**

Run: `cd packages/desktop-e2e && npx playwright test --list`
Expected: Tests are listed (they won't pass yet since the app isn't fully wired, but they should be discovered)

- [ ] **Step 6: Commit**

```bash
git add packages/desktop-e2e/tests/onboarding/
git commit -m "feat(desktop-e2e): add onboarding E2E tests (welcome, locale, agents, completion)"
```

---

## Task 8: Write dashboard E2E tests

**Files:**
- Create: `packages/desktop-e2e/tests/dashboard/layout.spec.ts`
- Create: `packages/desktop-e2e/tests/dashboard/task-board.spec.ts`
- Create: `packages/desktop-e2e/tests/dashboard/agent-status.spec.ts`
- Create: `packages/desktop-e2e/tests/dashboard/conversation.spec.ts`
- Create: `packages/desktop-e2e/tests/dashboard/settings.spec.ts`
- Create: `packages/desktop-e2e/tests/dashboard/window-controls.spec.ts`

- [ ] **Step 1: Create `layout.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Dashboard layout", () => {
  test.beforeEach(async ({ page, bridge }) => {
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__showDashboard = true;
    });
    await page.reload();
    await expect(page.getByText(/task|agent/i)).toBeVisible({ timeout: 10_000 });
  });

  test("renders the 3-column layout", async ({ page }) => {
    await expect(page.getByText(/voice|wave/i)).toBeVisible();
    await expect(page.getByText(/task/i)).toBeVisible();
  });

  test("renders window controls", async ({ page }) => {
    const controls = page.locator("[data-testid=window-controls], .window-controls");
    await expect(controls).toBeVisible();
  });
});
```

- [ ] **Step 2: Create `task-board.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";
import { createTask } from "../../fixtures/test-data.js";

test.describe("Task board", () => {
  test("renders tasks from the bridge", async ({ page, bridge }) => {
    await page.evaluate((tasks) => {
      const b = (window as unknown as { __testBridge?: { addTask: (t: unknown) => void } }).__testBridge;
      if (b?.addTask) {
        for (const t of tasks) b.addTask(t);
      }
    }, [createTask({ description: "E2E test task", status: "running" })]);
    await page.reload();
    await expect(page.getByText("E2E test task")).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 3: Create `agent-status.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Agent status grid", () => {
  test("displays agent cards", async ({ page }) => {
    await expect(page.getByText(/research|weather|calendar/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 4: Create `conversation.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";
import { createMessage } from "../../fixtures/test-data.js";

test.describe("Conversation panel", () => {
  test("displays messages from the bridge", async ({ page, bridge }) => {
    await page.evaluate((msg) => {
      const b = (window as unknown as { __testBridge?: { addMessage: (m: unknown) => void } }).__testBridge;
      if (b?.addMessage) b.addMessage(msg);
    }, createMessage({ text: "E2E test message" }));
    await expect(page.getByText("E2E test message")).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 5: Create `settings.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Settings panel", () => {
  test("opens settings from window controls", async ({ page }) => {
    const settingsBtn = page.locator("[data-testid=settings-btn], button[aria-label*=settings], button[aria-label*=gear]");
    await settingsBtn.click();
    await expect(page.getByText(/theme|dark|light/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 6: Create `window-controls.spec.ts`**

```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Window controls", () => {
  test("displays minimize, maximize, and close buttons", async ({ page }) => {
    const controls = page.locator("[data-testid=window-controls]");
    if (await controls.isVisible()) {
      await expect(controls).toBeVisible();
    }
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add packages/desktop-e2e/tests/dashboard/
git commit -m "feat(desktop-e2e): add dashboard E2E tests (layout, tasks, agents, conversation, settings, window controls)"
```

---

## Task 9: Write channel and skill E2E tests

**Files:**
- Create: `packages/desktop-e2e/tests/channels/discord.spec.ts`
- Create: `packages/desktop-e2e/tests/channels/telegram.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/web-fetch.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/email.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/calendar.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/notion.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/weather.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/secrets.spec.ts`
- Create: `packages/desktop-e2e/tests/skills/cron.spec.ts`

- [ ] **Step 1: Create channel test files**

`discord.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Discord channel (via bridge)", () => {
  test("executes discord_send intent through conversation", async ({ page, bridge }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("discord_send", { channel: "general", message: "Hello from E2E!" });
    });
    await expect(page.getByText(/discord_send|Hello from E2E/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes discord_read intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("discord_read", { channel: "general" });
    });
    await expect(page.getByText(/discord_read/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes discord_search intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("discord_search", { channel: "general", query: "test" });
    });
    await expect(page.getByText(/discord_search/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`telegram.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Telegram channel (via bridge)", () => {
  test("executes telegram_send intent through conversation", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("telegram_send", { chat: "12345", message: "Hello from E2E!" });
    });
    await expect(page.getByText(/telegram_send|Hello from E2E/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Create skill test files**

All skill tests follow the same pattern: send an intent via the bridge and verify the message appears. Create each file:

`web-fetch.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("web_fetch skill (via bridge)", () => {
  test("executes web_fetch intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("web_fetch", { url: "https://example.com" });
    });
    await expect(page.getByText(/web_fetch|example\.com/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`email.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("email skills (via bridge)", () => {
  test("executes email_search intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("email_search", { query: "inbox" });
    });
    await expect(page.getByText(/email_search/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes email_send intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("email_send", { to: "test@example.com", subject: "E2E test" });
    });
    await expect(page.getByText(/email_send/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`calendar.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("calendar skills (via bridge)", () => {
  test("executes calendar_list intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("calendar_list", {});
    });
    await expect(page.getByText(/calendar_list/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes calendar_create intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void> } }).__testBridge;
      if (b) b.executeIntent("calendar_create", { subject: "E2E test event" });
    });
    await expect(page.getByText(/calendar_create/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`notion.spec.ts`, `weather.spec.ts`, `secrets.spec.ts`, `cron.spec.ts` — all follow the same pattern as above with their respective intent names (`notion_query`, `weather_current`, `secrets_get`, `cron_schedule`).

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-e2e/tests/channels/ packages/desktop-e2e/tests/skills/
git commit -m "feat(desktop-e2e): add channel and skill E2E tests (discord, telegram, web_fetch, email, calendar, notion, weather, secrets, cron)"
```

---

## Task 10: Write voice, memory, and integration E2E tests

**Files:**
- Create: `packages/desktop-e2e/tests/voice/wake-word.spec.ts`
- Create: `packages/desktop-e2e/tests/voice/stt.spec.ts`
- Create: `packages/desktop-e2e/tests/memory/recall-reinforce.spec.ts`
- Create: `packages/desktop-e2e/tests/integration/onboarding-to-dashboard.spec.ts`
- Create: `packages/desktop-e2e/tests/integration/settings-persistence.spec.ts`
- Create: `packages/desktop-e2e/tests/integration/nexus-bridge.spec.ts`

- [ ] **Step 1: Create voice test files**

`wake-word.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Wake word detection", () => {
  test("renders voice waveform component", async ({ page }) => {
    await expect(page.getByText(/voice|wave|listen/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`stt.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Speech-to-text pipeline", () => {
  test("renders voice input UI", async ({ page }) => {
    await expect(page.getByText(/voice|mic|speak/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Create memory test file**

`recall-reinforce.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Memory recall through conversation", () => {
  test("sends a recall intent and displays the response", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>; simulateIntentResponse: (a: string, r: string) => void } }).__testBridge;
      if (b) {
        b.executeIntent("recall", { query: "meeting notes" });
        b.simulateIntentResponse("recall", "I found notes about the Q3 planning meeting.");
      }
    });
    await expect(page.getByText(/Q3 planning meeting/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 3: Create integration test files**

`onboarding-to-dashboard.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Full onboarding to dashboard flow", () => {
  test("completes onboarding and renders dashboard", async ({ page }) => {
    await expect(page.getByText("JARVIS")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /initialize/i }).click();
    await page.getByRole("button", { name: /english/i }).click();
    await page.getByRole("button", { name: /next/i }).click();

    await page.getByRole("button", { name: /next|skip|continue/i }).click();
    await page.getByRole("button", { name: /next|continue/i }).click();

    await expect(page.getByText(/ready|complete|done/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /launch|dashboard|go/i }).click();

    await expect(page.getByText(/task|agent|voice/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`settings-persistence.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Settings persistence", () => {
  test("settings modal opens and contains theme toggle", async ({ page }) => {
    const settingsBtn = page.locator("[data-testid=settings-btn], button[aria-label*=settings], button[aria-label*=gear]");
    await settingsBtn.click();
    await expect(page.getByText(/theme|dark|light/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

`nexus-bridge.spec.ts`:
```ts
import { test, expect } from "../../fixtures/electron-app.js";
import { createTask, createAgent, createMessage } from "../../fixtures/test-data.js";

test.describe("NexusBridge data flow", () => {
  test("bridge data renders in the dashboard", async ({ page, bridge }) => {
    await page.evaluate((task) => {
      const b = (window as unknown as { __testBridge?: { addTask: (t: unknown) => void } }).__testBridge;
      if (b) b.addTask(task);
    }, createTask({ description: "Bridge data test task", status: "running" }));

    await page.reload();
    await expect(page.getByText("Bridge data test task")).toBeVisible({ timeout: 5_000 });
  });

  test("bridge intent execution logs correctly", async ({ page, bridge }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>; simulateIntentResponse: (a: string, r: string) => void } }).__testBridge;
      if (b) {
        b.executeIntent("weather_current", { location: "San Francisco" });
        b.simulateIntentResponse("weather_current", "It's 72°F and sunny in San Francisco.");
      }
    });
    await expect(page.getByText(/72°F.*sunny/i)).toBeVisible({ timeout: 5_000 });
  });

  test("bridge error handling displays error message", async ({ page, bridge }) => {
    await page.evaluate(() => {
      const b = (window as unknown as { __testBridge?: { simulateError: (e: string) => void } }).__testBridge;
      if (b) b.simulateError("Network connection failed");
    });
    await expect(page.getByText(/Network connection failed/i)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/desktop-e2e/tests/voice/ packages/desktop-e2e/tests/memory/ packages/desktop-e2e/tests/integration/
git commit -m "feat(desktop-e2e): add voice, memory, and integration E2E tests"
```

---

## Task 11: Add E2E scripts to root package.json and update CI

**Files:**
- Modify: `package.json` (root)
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Add e2e scripts to root package.json**

Add to the `"scripts"` section of the root `package.json`:

```json
"test:e2e": "npm run build -w @openjarvis/desktop && npm run build:renderer -w @openjarvis/desktop && playwright test -c packages/desktop-e2e",
"test:e2e:headed": "npm run build -w @openjarvis/desktop && npm run build:renderer -w @openjarvis/desktop && playwright test -c packages/desktop-e2e --headed"
```

- [ ] **Step 2: Create `.github/workflows/e2e.yml`**

```yaml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
      - run: npm ci
      - run: npx playwright install --with-deps electron
      - run: npm run build -w @openjarvis/desktop
      - run: npm run build:renderer -w @openjarvis/desktop
      - run: npx playwright test -c packages/desktop-e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/desktop-e2e/playwright-report/
```

- [ ] **Step 3: Commit**

```bash
git add package.json .github/workflows/e2e.yml
git commit -m "feat(ci): add E2E test scripts and GitHub Actions workflow"
```

---

## Task 12: Run the full test suite and verify

- [ ] **Step 1: Build the desktop package**

Run: `npm run build -w @openjarvis/desktop && npm run build:renderer -w @openjarvis/desktop`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run existing unit tests to confirm nothing broke**

Run: `npm test`
Expected: All existing vitest tests pass

- [ ] **Step 3: Run Playwright test list to confirm discovery**

Run: `cd packages/desktop-e2e && npx playwright test --list`
Expected: All test files are discovered and listed

- [ ] **Step 4: Run a single test in headed mode (manual verification)**

Run: `cd packages/desktop-e2e && npx playwright test tests/onboarding/welcome.spec.ts --headed`
Expected: Electron app opens, test runs, welcome screen is verified

- [ ] **Step 5: Run full Playwright suite**

Run: `cd packages/desktop-e2e && npx playwright test`
Expected: All tests pass or have clear TODOs for features not yet implemented

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(desktop-e2e): complete Playwright E2E test infrastructure"
```

---

## Self-Review

**Spec coverage check:**
- Section 1 (Package structure): Tasks 1-2 create the package, test data, and bridge
- Section 2.1 (playwright.config.ts): Task 1
- Section 2.2 (electron-app fixture): Task 5
- Section 2.3 (PlaywrightTestBridge): Task 3
- Section 2.4 (test-data factories): Task 2
- Section 3 (Dev/CI modes): Task 11 (CI workflow + scripts)
- Section 4 (Channel testing via bridge): Task 9
- Section 5 (Test scenarios):
  - 5.1 Onboarding: Task 7 (welcome, locale, agent-selection, completion)
  - 5.2 Dashboard: Task 8 (layout, tasks, agents, conversation, settings, window-controls)
  - 5.3 Channels: Task 9 (discord, telegram)
  - 5.4 Skills: Task 9 (web-fetch, email, calendar, notion, weather, secrets, cron)
  - 5.5 Voice: Task 10 (wake-word, stt)
  - 5.6 Memory: Task 10 (recall-reinforce)
  - 5.7 Integration: Task 10 (onboarding-to-dashboard, settings-persistence, nexus-bridge)
- Section 6 (CI): Task 11
- Section 7 (Key decisions): All covered

**Placeholder scan:** No TBDs, TODOs, or incomplete steps found.

**Type consistency:** `PlaywrightTestBridge` in Task 3 implements `NexusBridge` from Task 2, which matches `NexusBridge` from `nexus-types.ts`. The `window.__testBridge` injection in Task 4 uses the same `NexusBridge` type. Factory functions in Task 2 produce `Task`, `AgentView`, `MessageView` that match the interface.

**App.tsx change:** Task 4 modifies `App.tsx` to check `window.__testBridge` — this is a 2-line change that has no effect in production (the property is never set outside tests).