# Playwright E2E Automation Design

**Date:** 2026-06-19
**Scope:** Full-stack E2E tests for all 160 features, running against the real Electron desktop app
**Approach:** Playwright with Electron launch + PlaywrightTestBridge for deterministic test data

---

## 1. Package Structure

New package: `packages/desktop-e2e`

```
packages/desktop-e2e/
  playwright.config.ts
  package.json
  tsconfig.json
  fixtures/
    electron-app.ts          # Playwright fixture: launch Electron, inject test bridge
    test-bridge.ts           # PlaywrightTestBridge implementing NexusBridge interface
    test-data.ts             # Deterministic test data factories
  tests/
    onboarding/
      welcome.spec.ts
      locale-setup.spec.ts
      voice-calibration.spec.ts
      agent-selection.spec.ts
      completion.spec.ts
    dashboard/
      layout.spec.ts
      task-board.spec.ts
      agent-status.spec.ts
      conversation.spec.ts
      settings.spec.ts
      window-controls.spec.ts
    channels/
      discord.spec.ts
      telegram.spec.ts
    skills/
      web-fetch.spec.ts
      email.spec.ts
      calendar.spec.ts
      notion.spec.ts
      weather.spec.ts
      secrets.spec.ts
      cron.spec.ts
    voice/
      wake-word.spec.ts
      stt.spec.ts
    memory/
      recall-reinforce.spec.ts
    integration/
      onboarding-to-dashboard.spec.ts
      settings-persistence.spec.ts
      nexus-bridge.spec.ts
```

---

## 2. Core Architecture

### 2.1 playwright.config.ts

```ts
import { defineConfig } from "@playwright/test";

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
      use: {
        // Injected by fixture
      },
    },
  ],
});
```

### 2.2 fixtures/electron-app.ts

Custom Playwright fixture that:

1. Compiles the Electron main process TypeScript (`tsc -b packages/desktop`)
2. Starts the Vite dev server on port 5173 (renderer)
3. Launches Electron via `_electron.launch()` with the compiled main process
4. Injects `PlaywrightTestBridge` into the renderer — `App.tsx` currently uses `createMockNexusBridge()` hardcoded. The fixture will expose `window.__testBridge` on the page via `page.evaluate()` and `App.tsx` will be modified to check `window.__testBridge` first, falling back to `createMockNexusBridge()`. This is a 2-line change in `App.tsx`.
5. Waits for the app window to be ready (checks for a sentinel element)
6. Provides `page`, `electronApp`, `bridge` in test context
7. Cleans up: closes Electron, stops Vite dev server

Key APIs:
```ts
import { test as base, expect } from "@playwright/test";
import type { PlaywrightTestBridge } from "./test-bridge";

type ElectronTestFixture = {
  electronApp: ElectronApplication;
  page: Page;
  bridge: PlaywrightTestBridge;
};

export const test = base.extend<ElectronTestFixture>({
  electronApp: async ({}, use) => { /* launch, use, cleanup */ },
  page: async ({ electronApp }, use) => { /* electronApp.firstWindow(), use */ },
  bridge: async ({ page }, use) => { /* inject bridge, use */ },
});

export { expect };
```

### 2.3 fixtures/test-bridge.ts

`PlaywrightTestBridge` implements the `NexusBridge` interface from `packages/jarvis/src/hub.ts`. It:

- Provides deterministic tasks, agents, messages, and events
- Exposes methods for tests to drive data:
  - `bridge.addTask(task)` — adds a task to the task board
  - `bridge.updateTask(taskId, updates)` — updates a task
  - `bridge.addAgentEvent(agentId, event)` — simulates an agent event
  - `bridge.addMessage(message)` — adds a conversation message
  - `bridge.simulateIntentResponse(intent, response)` — simulates an intent→response flow
  - `bridge.simulateError(error)` — simulates an error state
  - `bridge.reset()` — clears all test data
- Injects into the renderer via `page.evaluate()` to set `window.__testBridge`, which `App.tsx` picks up as the nexus bridge source
- Can simulate errors, delays, and edge cases
- No external services needed — pure in-memory

### 2.4 fixtures/test-data.ts

Factory functions for deterministic test data:

```ts
export function createTask(overrides?: Partial<Task>): Task
export function createAgent(overrides?: Partial<AgentInfo>): AgentInfo
export function createMessage(overrides?: Partial<ConversationMessage>): ConversationMessage
export function createIntent(action: string, payload?: unknown): Intent
```

Each factory generates consistent, unique test data with sensible defaults.

---

## 3. Dev vs CI Modes

### 3.1 Dev Mode (local machine)

```bash
# Start Vite dev server in one terminal
cd packages/desktop && npm run dev:renderer

# Run Playwright tests in another terminal (headed)
cd packages/desktop-e2e && npx playwright test --headed
```

- Electron window opens visibly
- Tests interact with the real UI in real time
- Vite dev server hot-reloads renderer changes
- Developer sees the app running and test automation driving it

### 3.2 CI Mode (GitHub Actions / Docker gate)

```bash
# In CI (headless, no display)
npx playwright test
```

- Uses `xvfb-run` on Linux for headless Electron display
- `playwright install --with-deps electron` installs browser binaries
- Single worker to avoid flaky Electron multi-window issues
- 2 retries for flakiness
- HTML report for artifacts

### 3.3 Scripts in package.json

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --headed --debug",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  }
}
```

---

## 4. Channel & External API Testing

For features that call external APIs (Discord REST, Telegram Bot API, Graph API, Notion API):

- Tests route through the desktop UI's conversation panel
- `PlaywrightTestBridge` intercepts NexusBridge calls and returns deterministic responses
- UI rendering and data flow are verified, not actual API calls
- API calls are unit-tested in their respective packages (99%+ coverage already)

For manual "real API" smoke testing:
- A `RealApiBridge` can be used with API keys from environment variables
- Only runs manually (not in CI), gated behind `REAL_API=1` env var

---

## 5. Test Scenarios

### 5.1 Onboarding Flow

| Test | What it verifies |
|------|------------------|
| `welcome.spec.ts` | Welcome screen renders, "Initialize" button is visible, click starts onboarding |
| `locale-setup.spec.ts` | Locale selection renders, system locale detected, selecting locale persists |
| `voice-calibration.spec.ts` | Calibration UI renders, start/stop calibration, progress indicator |
| `agent-selection.spec.ts` | Agent toggles render, enabling/disabling agents updates count |
| `completion.spec.ts` | Completion screen renders, "Launch Dashboard" transitions to dashboard |

### 5.2 Dashboard

| Test | What it verifies |
|------|------------------|
| `layout.spec.ts` | 3-column layout renders, responsive, min 900x600 constraint |
| `task-board.spec.ts` | Tasks render with status dots, progress bars, task detail on click |
| `agent-status.spec.ts` | Agent grid renders, click opens detail modal, capabilities shown |
| `conversation.spec.ts` | Panel expands/collapses, messages render, input sends |
| `settings.spec.ts` | Settings modal opens, theme toggles, reduced motion works, saves persist |
| `window-controls.spec.ts` | Min/max/close buttons present, settings gear opens panel |

### 5.3 Channels

| Test | What it verifies |
|------|------------------|
| `discord.spec.ts` | Discord connect UI, send message, search messages |
| `telegram.spec.ts` | Telegram connect UI, send message |

### 5.4 Skills (through conversation panel)

| Test | What it verifies |
|------|------------------|
| `web-fetch.spec.ts` | `web_fetch` intent renders response |
| `email.spec.ts` | Email search/read/draft/send intent flows |
| `calendar.spec.ts` | Calendar list/create/update intent flows |
| `notion.spec.ts` | Notion query/create intent flows |
| `weather.spec.ts` | Weather current/forecast intent flows |
| `secrets.spec.ts` | `op://` resolution intent flow |
| `cron.spec.ts` | Schedule/list/cancel intent flows |

### 5.5 Voice

| Test | What it verifies |
|------|------------------|
| `wake-word.spec.ts` | Wake word detection UI, cooldown behavior |
| `stt.spec.ts` | STT pipeline states (idle → listening → thinking → responding) |

### 5.6 Memory

| Test | What it verifies |
|------|------------------|
| `recall-reinforce.spec.ts` | Memory recall through conversation, reinforcement |

### 5.7 Integration

| Test | What it verifies |
|------|------------------|
| `onboarding-to-dashboard.spec.ts` | Full flow: onboarding through all steps → dashboard renders |
| `settings-persistence.spec.ts` | Settings survive app restart (close → relaunch → verify) |
| `nexus-bridge.spec.ts` | Real `createNexusBridge()` data flows through UI |

---

## 6. CI Integration

### 6.1 Docker Gate Update

The existing Docker gate (Dockerfile.test) will be updated to:

1. Install Playwright and Electron system dependencies
2. Install Chromium browser for any web-based tests
3. Run `npx playwright install --with-deps electron`
4. Add `npx playwright test` after the existing `npm run coverage` step

### 6.2 GitHub Actions Workflow

A new workflow file `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]
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
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/desktop-e2e/playwright-report/
```

---

## 7. Key Decisions

1. **PlaywrightTestBridge over Real NexusEngine** — Deterministic, fast, no external deps. Real engine tested in unit tests (99%+ coverage).
2. **Playwright Electron support** — First-class, launches real app, handles both headed and headless.
3. **Channel tests use bridge, not real APIs** — API calls are unit-tested. E2E tests verify UI rendering and data flow.
4. **Single `electron` project in Playwright config** — Keeps it simple. Can add `chromium`/`firefox` projects later for web-only features.
5. **Test data factories** — Consistent, unique, deterministic test data with sensible defaults.
6. **No separate test runner** — Uses `@playwright/test` as the runner, consistent with industry standard.
7. **App.tsx bridge injection** — A 2-line change in `App.tsx` checks `window.__testBridge` before falling back to `createMockNexusBridge()`. In production, `window.__testBridge` is never set, so the mock bridge is used. In tests, the Playwright fixture injects the test bridge. This avoids any test-only code paths in production.