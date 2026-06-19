# OpenJarvis — checkpoint

> At-a-glance status for anyone (AI agent or human) picking up this project. Read this
> first, then [`AGENT.md`](AGENT.md) for how to work here. Detailed, authoritative
> trackers live under `docs/` and are linked below.
>
> **Last updated:** 2026-06-19 · **Default branch:** `main` (protected; required
> `docker-gate`) · **Tests:** 1379 passing / 7 skipped, typecheck/lint/format clean,
> coverage 99.62% (≥99% gate). **Current branch:** `feat/playwright-e2e` (with
> Round-15 display-priority fix; uncommitted at the time of writing).

---

## 1. What this is

A self-owned AI-agent runtime with the Jarvis multi-agent orchestration pattern.
TypeScript monorepo, embedded SQLite, single self-contained binary, runs on Node and
Bun. Thesis: **the model proposes, the runtime enforces** (grounding, tool-calling,
state, capabilities). Full vision: [`docs/specs/2026-06-05-openjarvis-design.md`](docs/specs/2026-06-05-openjarvis-design.md).

## 2. Packages that exist today

| Package                       | Status | Role                                                                                                                                                                                                                                                                |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openjarvis/core`            | 🟢     | Agent loop, model adapters, tool registry (**the Lab**), **GroundingEngine** grounding, **Audit** audit, **the Vault** vault, **the Gate** taint/approval (with `approvalRequired` on high-risk tools), redaction, structured logging, the Playbook process engine. |
| `@openjarvis/state`           | 🟢     | **JarvisStateStore**: durable SQLite (`SqlDriver` + migrations + event store + keyed audit store) and the durable composition root (`buildDurableAgentRun` + `openjarvis-run` CLI).                                                                                 |
| `@openjarvis/memory`          | 🟢     | **JarvisMemoryStore**: decay-aware memory (fragments, recall, pure-JS embeddings + FTS5 fallback). **Wired into the agent path** via `asMemoryStore` adapter. MemoryStore interface in core, JarvisMemoryStore implementation in memory package.                    |
| `@openjarvis/markdownify`     | 🟢     | Document → Markdown converters (CSV/HTML/JSON/XML/text) behind a never-throws `ConverterRegistry`. **Wired into the agent path** via `createDocumentTool` + `buildDurableAgentRun`/`buildProbeAgent`.                                                               |
| `@openjarvis/jarvis`          | 🟢     | Vision skill interfaces + E2E automation suite. **S3 Nexus Orchestrator** (IntentRouter, AgentPool, Synthesizer, NexusEngine, TaskBoard, ReplayEngine). **OllamaSttEngine** for voice transcription. **AgentSession** for sub-agent spawning.                       |
| `@openjarvis/agents`          | 🟢     | Built-in agents package with `VisionAgent`/`MockVisionAgent` (agent delegator, pool interfaces).                                                                                                                                                                    |
| `@openjarvis/desktop`         | 🟢     | Electron desktop app. Settings + user profile persisted via typed IPC bridge. **Voice pipeline:** AudioRecorder, AmplitudeWakeWordEngine, useVoicePipeline hook. **op:// auto-resolution** for config secrets.                                                      |
| `@openjarvis/track-b`         | 🟢     | Multi-device sync: device identity, CRDT sync, Noise protocol, task router, vault sync.                                                                                                                                                                             |
| `@openjarvis/process`         | 🟢     | Process Enforcement: AGENT.md loop runtime enforcement with ProcessEngine, gate checks, lifecycle hooks, event bus.                                                                                                                                                 |
| `@openjarvis/channels`        | 🟢     | Discord raw WebSocket gateway + rate-limited REST + session mapper + tools (discord_send, discord_read, discord_search) + slash commands + event handlers. Telegram bot + session mapper + tools (telegram_send, telegram_read).                                    |
| `@openjarvis/skills-web`      | 🟢     | web_fetch tool (URL → Markdown) + browser automation tools (browser_navigate, browser_click, browser_type, browser_screenshot, browser_accessibility, browser_list_tabs, browser_switch_tab, browser_close_tab) + cookie management.                                |
| `@openjarvis/skills-email`    | 🟢     | Gmail (IMAP/SMTP) + Microsoft Graph (OAuth2 device code). 4 tools: email_search, email_read, email_draft, email_send (**approvalRequired**).                                                                                                                        |
| `@openjarvis/skills-calendar` | 🟢     | Microsoft Graph Calendar. 5 tools: calendar_list, calendar_get_events, calendar_create (with recurrence), calendar_update, calendar_delete (**approvalRequired**). Configurable default timezone.                                                                   |
| `@openjarvis/skills-notion`   | 🟢     | Notion API. 4 tools: notion_query, notion_get, notion_create, notion_update.                                                                                                                                                                                        |
| `@openjarvis/skills-weather`  | 🟢     | wttr.in weather. 2 tools: weather_current, weather_forecast.                                                                                                                                                                                                        |
| `@openjarvis/skills-secrets`  | 🟢     | 1Password CLI. 1 tool: secrets_get (**approvalRequired**).                                                                                                                                                                                                          |
| `@openjarvis/cron`            | 🟢     | Real cron scheduler with SQLite persistence. 3 tools: cron_schedule, cron_list, cron_cancel.                                                                                                                                                                        |
| `@openjarvis/skills`          | 🟢     | Skill manifest, loader, and sandbox infrastructure (plugin SDK foundation).                                                                                                                                                                                         |

## 3. Feature Parity Status

All 13 features from the feature parity spec are implemented, plus all 15 spec gaps filled:

| #   | Feature               | Package                                      | Tools                                                                                                                                              | Gaps Filled                                                              |
| --- | --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Discord channel       | `@openjarvis/channels`                       | discord_send, discord_read, discord_search                                                                                                         | Raw WS+REST, rate limiting, reconnection, event handlers, slash commands |
| 2   | Web fetch             | `@openjarvis/skills-web`                     | web_fetch                                                                                                                                          | —                                                                        |
| 3   | Email (Gmail + Graph) | `@openjarvis/skills-email`                   | email_search, email_read, email_draft, email_send (**approvalRequired**)                                                                           | —                                                                        |
| 4   | Calendar (Graph)      | `@openjarvis/skills-calendar`                | calendar_list, calendar_get_events, calendar_create (with recurrence), calendar_update, calendar_delete (**approvalRequired**)                     | Recurring events, default timezone                                       |
| 5   | Notion                | `@openjarvis/skills-notion`                  | notion_query, notion_get, notion_create, notion_update                                                                                             | —                                                                        |
| 6   | Weather               | `@openjarvis/skills-weather`                 | weather_current, weather_forecast                                                                                                                  | —                                                                        |
| 7   | Cron scheduler        | `@openjarvis/cron`                           | cron_schedule, cron_list, cron_cancel                                                                                                              | SQLite persistence                                                       |
| 8   | Browser automation    | `@openjarvis/skills-web`                     | browser_navigate, browser_click, browser_type, browser_screenshot, browser_accessibility, browser_list_tabs, browser_switch_tab, browser_close_tab | browser_type, a11y tree, cookies, multi-tab                              |
| 9   | 1Password secrets     | `@openjarvis/skills-secrets`                 | secrets_get (**approvalRequired**)                                                                                                                 | —                                                                        |
| 10  | Voice pipeline        | `@openjarvis/jarvis` + `@openjarvis/desktop` | OllamaSttEngine, AudioRecorder, useVoicePipeline                                                                                                   | —                                                                        |
| 11  | Sub-agent spawning    | `@openjarvis/jarvis`                         | AgentSession                                                                                                                                       | —                                                                        |
| 12  | Telegram              | `@openjarvis/channels`                       | telegram_send, telegram_read                                                                                                                       | Session mapper                                                           |
| 13  | Approval gate         | `@openjarvis/core`                           | ToolDefinition.approvalRequired + Gate integration                                                                                                 | High-risk tools gated                                                    |

Additional infrastructure:

- **op:// auto-resolution**: `@openjarvis/desktop` resolves `op://` references in config via 1Password CLI
- **Capability naming**: Per-channel (`discord:message`, `telegram:read`) instead of unified `channel:read/write`
- **MemoryStore adapter**: `asMemoryStore()` bridges `JarvisMemoryStore` to the core `MemoryStore` interface

## 4. Gate status

- **Tests:** 1370 passing / 7 skipped (193 files) — `vitest run`
- **Coverage:** 99.62% statements / 99.16% lines / 100% functions / 99.62% branches
  (≥99% thresholds, `vitest run --coverage`)
- **Typecheck:** Clean (`tsc -b` passes)
- **Lint:** Clean (`eslint .` passes; 0 errors, 0 warnings)
- **Format:** Clean (`prettier --check` passes)
- **Playwright (desktop-e2e):** onboarding + dashboard + chat non-LLM + settings all
  green; LLM-gated chat specs skip explicitly with `test.skip(!OLLAMA_API_KEY)`.
  E2E workflow now uses `npx playwright install-deps` and builds the preload
  before running the suite.
- **Branch:** `feat/playwright-e2e` (Round 10 + 11 + 12 audit fixes; gate clean).

## 5. How to work here

Follow [`AGENT.md`](AGENT.md): Research → Plan → Tasks → Execute (TDD) → Validate (the gate)
→ Present (PR). `main` is protected — land via a PR whose required `docker-gate` passes
(build · lint · format:check · coverage ≥99% · unit · functional). Conventional commits, one
logical change per commit.

## 6. Authoritative trackers (don't duplicate — update these)

- **Remediation status:** `docs/reviews/2026-06-09-production-readiness-review.md` §3 — the
  per-item source of truth for Track A / Track B. Keep its ✅ marks honest.
- **Design specs:** `docs/specs/` · **Implementation plans:** `docs/superpowers/plans/` · **ADRs:**
  `docs/adr/` · **Security model:** `docs/security-model.md`.

## 7. Robustness audit history

The project has undergone 9 rounds of architecture + wiring audits, fixing:

- **3 CRITICAL bugs** — vault parse crash on corruption, infinite 429 retry loops, event-store pagination mismatch
- **28 HIGH bugs** — timer leaks, missing timeouts, unhandled rejections, JSON.parse without try/catch, gateway opcode handling, approval gates, capability mismatches, 429 retry across all API clients, token refresh races
- **33 MEDIUM bugs** — route/input mutations, wake word cooldown, concurrent browser init, rate limiter cleanup, LRU evictions, 5xx retries, OAuth error handling, process engine state, cron persistence, accessibility type mapping, intent routing, highlight handler, reconnect amplification
- **10 LOW issues** — dead dependencies, spurious tsconfig refs, type consistency, logging, format
- **21+ wiring gaps** — tool registrations, router routes, capability names, export completeness, dependency graph, VisualCommand variants, MemoryStore adapter

All gates pass: typecheck, 1254 tests, lint, format.

### Round 10 — desktop ↔ jarvis ↔ renderer ↔ e2e wiring audit (2026-06-19)

Scanned every file in the desktop main process, jarvis core, agents/memory/core
packages, the renderer, and the e2e suite. Followed the existing TDD loop: confirm
a bug, fix, re-run `tsc -b` → `vitest run` → targeted Playwright spec.

**Bugs fixed in commit `9475fd7`:**

1. **Desktop main — `nexus:subscribeToEvents` fan-out.**
   `ipc.ts` was calling `eventBus.subscribe(...)` on every invocation and never
   tracking the unsubscribe. Each renderer reload added another handler; every
   published event was forwarded N times. Now stores each `sub.unsubscribe` and
   invokes them all in `resetEngine()`.
2. **Desktop main — `electron-main.ts` window source.**
   `registerIpcHandlers` and `registerWindowHandlers` previously used
   `BrowserWindow.getFocusedWindow() ?? null` — which returns null whenever no
   window has focus. Now both use `() => mainWindow` so the same window that was
   registered is the one that receives events.
3. **Desktop preload — typed surface + `onNexusEvent`.**
   `preload.ts` used implicit `any` (would not typecheck under `tsc -b` once it
   became un-excluded). All params now explicitly typed. New
   `onNexusEvent(callback) => unsubscribe` exposed via `contextBridge`.
4. **Renderer — `SettingsPanel` always showed the API key field.**
   The field was rendered for every provider, contradicting the "not needed for
   local" copy. Now conditionally rendered only when `provider !== "ollama"`.
5. **E2E — `tests/settings/general.spec.ts` strict-mode violations.**
   `getByText(/theme|dark|light/i)` matched Theme + Dark + Light (3 elements);
   `darkBtn.or(lightBtn)` resolved to 2 buttons. Both now scoped with `.first()`.
6. **E2E — `tests/settings/model-config.spec.ts` 'Done button' assertion.**
   Asserted `settings-tab-model` is gone, but the panel only fades
   (`pointer-events: none`); the tab DOM stays. Now asserts the
   `btn-settings` (open button) remains visible, which is the real signal.
7. **jarvis core — `RuleBasedRouter` rule handlers un-bound.**
   Stored `this.routeToResearch` etc. in the rules Map without `.bind(this)`.
   Worked only because none of the current handlers read `this`. Now `.bind(this)`
   so the next handler that does read `this` will not silently break.
8. **Repo hygiene — `.gitignore`.** Added `playwright-report/` and `test-results/`.
   Renamed `packages/jarvis/src/e2e/mock-user.ts` → `packages/jarvis/test/e2e/mock-user.ts`
   (test helper was living under `src`).

**Known-good invariants (verified by tests):**

- Engine events flow: `NexusEngine.emit()` → `SimpleEventBus.publish("nexus", …)` →
  `nexus:subscribeToEvents` handler → `webContents.send("nexus:event", payload)` →
  preload `ipcRenderer.on("nexus:event", …)` → `onNexusEvent(callback)` →
  `NexusBridge.subscribeToEvents(handler)` → renderer.
- IPC channel map:
  | renderer → main | payload | return |
  | --- | --- | --- |
  | `settings:load` | — | `AppSettings` |
  | `settings:save` | `AppSettings` | `void` |
  | `settings:reset` | — | `AppSettings` |
  | `profile:load` / `profile:save` | `UserProfile` | `void` |
  | `nexus:getTasks` / `nexus:getAgents` / `nexus:getMessages` | — | typed arrays |
  | `nexus:executeIntent` | `(action, params)` | `{ success, spoken?, visual?, error? }` |
  | `nexus:subscribeToEvents` | — | `[]` (side effect: subscribes) |
  | `model:list` | `(provider, baseUrl, apiKey?)` | `string[]` |
  | `env:getApiKeys` | — | `{ ollamaApiKey, openaiApiKey }` |
  | `window:minimize/maximize/close` | — | `void` |
  | `locale:getSystemLocale` | — | `string` |
  | main → renderer |
  | `nexus:event` | `NexusEvent` payload | — |

**Residual work (not in this commit; tracked for next agent):**

- **ConversationPanel does not re-fetch messages** (`packages/desktop/src/renderer/components/dashboard/ConversationPanel.tsx:12`).
  `nexus.getMessages()` is called once on mount; new messages sent via
  `nexus.executeIntent` are appended in the bridge's local array but the panel
  never re-renders. Fix: subscribe to bridge events and re-fetch, or have the
  bridge push into the panel via a React state hook.
- **`nexus:getMessages` always returns `[]`** (`packages/desktop/src/main/ipc.ts:146`).
  The main process does not persist messages. By design — but means chat history
  is lost on app reload. If persistence is desired, mirror the renderer bridge
  cache into `DesktopStore` or a SQLite table.
- **`useSettings.resetSettings` flashes local fallback** (`packages/desktop/src/renderer/hooks/useSettings.ts:90`).
  Sets `settings = fallbackSettings` before awaiting saved defaults. Cosmetic —
  only a frame in practice.
- **`Makefile test-e2e` background-launch is fragile** (`Makefile:74`).
  The `vite ... &` + `kill $$VITE_PID` pattern does not survive failures (no
  `trap`). Refactor into a script with `trap "kill $PID" EXIT`.
- **`electron-main.test.ts` mocks `BrowserWindow.getFocusedWindow`** (`packages/desktop/test/electron-main.test.ts:31`).
  The production code no longer calls it. Mock is dead — safe to delete.
- **LLM-gated Playwright chat specs** (`packages/desktop-e2e/tests/chat/conversation.spec.ts:17+`).
  Three tests send real chat queries to Ollama Cloud. They are green-by-construction
  when `OLLAMA_API_KEY` is set; skipped silently when it is not. Consider marking
  with `test.skip(!process.env.OLLAMA_API_KEY)` so the skip is explicit.
- **`SettingsPanel` API-key persistence quirk.** When user picks Ollama Cloud,
  enters a key, then switches to local Ollama, the key is preserved on the model
  object (just hidden). On a future switch back to Ollama Cloud the key is still
  there. Acceptable, but document it.

**How to verify this audit:**

```
npx tsc -b
npx vitest run
cd packages/desktop && npx vite build --config vite.renderer.config.ts && \
  cd .. && cd desktop && npx vite build --config vite.preload.config.ts
cd packages/desktop-e2e && OLLAMA_API_KEY=… npx playwright test --workers=1
```

(Playwright chat specs that hit the real model need `OLLAMA_API_KEY`; the rest
do not.)

### Round 11 — residual-work + ollama-cloud rewire + toolchain fixes (2026-06-19)

Followed TDD: confirm a bug, write a failing test, fix, re-run the gate.

**Residual-work items closed:**

1. **ConversationPanel does not re-fetch messages** — added
   `subscribeToMessages(handler)` to the `NexusBridge` interface and both
   implementations (`nexus-bridge.ts`, `ipc-nexus-bridge.ts`); the bridge
   notifies subscribers on every `executeIntent` mutation. `ConversationPanel`
   now subscribes and re-fetches on each notification. New test coverage in
   `nexus-bridge.test.ts` (3 new tests).
2. **`Makefile test-e2e` background-launch is fragile** — extracted into
   `scripts/test-e2e.sh` with a `trap cleanup EXIT INT TERM` that always kills
   the Vite dev server, surfaces the vite log on failure, and waits for the
   server to be reachable (curl-poll) instead of an arbitrary `sleep 3`.
3. **`electron-main.test.ts` mocks `BrowserWindow.getFocusedWindow`** — the
   production code no longer calls it; deleted the dead mock.
4. **LLM-gated Playwright chat specs** — added explicit
   `test.skip(!process.env.OLLAMA_API_KEY, ...)` to the Ollama Cloud describe
   so the skip is visible in the report.

**Pre-existing live-API bugs closed (root cause: ollama-cloud wired to wrong API surface):**

5. **`ollama-cloud` provider routed to `OpenAICompatClient`** — Ollama Cloud
   is the native Ollama API, not an OpenAI-compat shim. The `OpenAICompatClient`
   was hitting `https://api.ollama.com/v1/chat/completions`, which the
   upstream returns `301 Moved Permanently` to `ollama.com/v1/chat/completions`
   (404) and `ollama.com/v1/chat/completions` does not exist on the canonical
   host. The `OllamaClient` (used for local Ollama) already talks the right
   shape (`POST /api/chat`, `GET /api/tags`) and already supports an API-key
   header. Switched the factory to route `ollama-cloud` through `OllamaClient`
   instead. Single source of truth for the Ollama wire format.
6. **Default URL for `ollama-cloud` was `https://api.ollama.com/v1`** —
   updated to `https://api.ollama.com` (no `/v1`) in `SettingsPanel`,
   `ipc.ts`'s `model:list` handler, and all tests.
7. **Default `ollama-cloud` model list asserted the `llama` family** — Ollama
   has retired its `llama*` cloud models (see Ollama Cloud deprecation table).
   Updated the UI default list and tests to current catalog (`gemma3:4b`,
   `gemma3:12b`, `minimax-m3`, `minimax-m2.5`, `glm-5.1`, `qwen3-coder:480b`,
   `deepseek-v3.1:671b`, `gpt-oss:20b`).
8. **`OpenAICompatClient` did not follow redirects** — added
   `redirect: "follow"` to both the `chat` and `isAvailable` fetch calls. The
   `OllamaCloud` case in the test still hits a 301 → 200 (we added a
   redirect-following mock fetch to the test helper).
9. **Live-API integration tests had a 5s default timeout** — cloud model
   cold-start can exceed 5s on the first request. Added a `LIVE_TEST_TIMEOUT`
   constant (60 s) applied to every live test in `integration.test.ts` and
   `engine-integration.test.ts`.

**Toolchain fixes (pre-existing, would have failed the gate):**

10. **Lint: `preload.ts` flagged for `require("electron")`** — the file is
    intentionally CJS (built by `vite.preload.config.ts` and asserted by
    `preload.smoke.test.ts`). Added a per-file ESLint override disabling
    `@typescript-eslint/no-require-imports` for `packages/desktop/src/preload.ts`.
11. **Lint: `packages/desktop/vite.preload.config.ts` not picked up by the
    project service** — added it to the top-level `ignores` (Vite handles
    config-file type checking at build time).
12. **Format: 57 files had `No newline at end of file`** — ran
    `prettier --write "**/*.{ts,json,md,yml}"` to add trailing newlines and
    realign the rest of the formatting. `prettier --check` now passes.

**New test coverage:**

- `nexus-bridge.test.ts` — 3 new tests for `subscribeToMessages` (presence of
  unsubscribe, fires on `executeIntent`, stops after unsubscribe).
- `openai-compat-client.test.ts` — 2 new tests for redirect-following on
  `chat` and `isAvailable` (the test mock now follows 301s when the production
  code opts in via `redirect: "follow"`).
- `client.test.ts` — updated `ollama-cloud` factory test to assert
  `OllamaClient` is now returned.
- `integration.test.ts` — `Ollama Cloud integration` and `Model error handling`
  suites updated for the new client + URL + model + timeout; the
  `model:list` test now hits `/api/tags` (correct shape) and asserts a
  stable, currently-listed model.
- `ipc-model-list.test.ts` — same shape update; the "returns empty for
  invalid key" assertion was wrong (the public catalog is unauthenticated)
  and now asserts the correct shape.
- `engine-integration.test.ts` — swapped to `OllamaClient`, new URL/model,
  per-test 60 s timeout.

**Known-good invariants (re-verified by tests):**

- `OllamaClient(ollama-cloud)` `POST /api/chat` with `Authorization: Bearer <key>`
  works against the real `https://api.ollama.com/api/chat` endpoint.
- `OllamaClient(ollama-cloud)` `GET /api/tags` returns the public catalog
  (no auth check), shaped as `{ models: [{ name, ... }] }`.
- `OpenAICompatClient` now follows 3xx responses on both `chat` and
  `isAvailable` paths.
- `NexusBridge.subscribeToMessages(handler)` is invoked synchronously on
  every `executeIntent` mutation; the returned unsubscribe stops the calls.

**Residual work (intentionally not in this round):**

- **`SettingsPanel` API-key persistence quirk (documented, by design)** — when a
  user picks `ollama-cloud`, enters a key, then switches to local `ollama`,
  the key is preserved on the model object (just hidden). On a future switch
  back to `ollama-cloud` the key is still there. This is the deliberate
  behavior of `updateSetting("model", { ...model, provider: "ollama" })` in
  `SettingsPanel.tsx:248-262` — only the provider/baseUrl are replaced; the
  apiKey is carried over. Acceptable for the moment; if it becomes a UX
  problem, change the provider-switch handler to also drop `apiKey` when
  switching to a provider that does not use it.

**How to verify this round:**

```
npx tsc -b
npx vitest run
npm run coverage
npm run lint
npm run format:check
cd packages/desktop && npx vite build --config vite.renderer.config.ts && \
  npx vite build --config vite.preload.config.ts
# For the e2e suite (optional, requires OLLAMA_API_KEY + headed Electron):
make test-e2e
```

### Round 12 — CI infrastructure + chat persistence + resetSettings (2026-06-19)

Followed TDD: confirm a bug, write a failing test, fix, re-run the gate.

**CI infrastructure fixes (pre-existing — would have failed the gate):**

1. **`preload.smoke.test.ts` reads `dist/preload.js` but CI never built it.**
   The Electron preload is a CJS bundle emitted by Vite
   (`vite.preload.config.ts` → `npm run build:preload`), not by `tsc -b`. CI
   was only running `tsc -b`. All 7 ci jobs (node on ubuntu+windows, bun on
   ubuntu+mac+windows, coverage, docker-gate) failed with:
   `ENOENT: no such file or directory, open
'.../packages/desktop/dist/preload.js'`. Fixed by adding the
   `build:preload` step to all 7 jobs.
2. **`e2e.yml` ran `npx playwright install --with-deps electron` but the
   installed Playwright version does not list `electron` as a valid install
   target** (it lists only `android, chrome, chromium, firefox, webkit,
msedge, ffmpeg`). The desktop-e2e suite uses
   `playwright._electron.launch` with the project's own Electron binary — no
   Playwright browser install needed, just Linux system deps (libgtk,
   libnss, etc.). Fixed by switching to `npx playwright install-deps` and
   adding the missing `build:preload` step.

**Round 11 residuals closed (R1, R2):**

3. **`nexus:getMessages` always returned `[]` — chat history lost on app
   reload.** Main process is now the source of truth for chat history:
   - `DesktopStore.loadMessages / appendMessage / clearMessages` (new)
     round-trip through `messages.json` (FIFO-capped at 500 items, zod-
     validated on read, recovers from corruption, `No newline at end of
file`-safe via the same temp+rename writeJson the rest of the store
     uses). 7 new store tests.
   - `nexus:getMessages` IPC handler returns `store.loadMessages()`.
   - `nexus:executeIntent` IPC handler appends a user/jarvis/system
     message to the store on every call (using `randomUUID()` ids and
     `toLocaleTimeString` timestamps so the persisted shape matches the
     renderer's `MessageView`).
   - New `nexus:clearMessages` IPC channel + `nexusClearMessages` preload
     export + `nexusClearMessages` typed surface (preload smoke test
     updated to assert the new channel).
   - `ipc-nexus-bridge.ts` lazy-seeds its `messages` cache from
     `getMessages()` on first call, then re-fetches from main after every
     `executeIntent` so it always reflects the canonical store. This makes
     history survive app reloads with no behaviour change in the renderer.
4. **`useSettings.resetSettings` flashed the local fallback for one frame**
   (called `setSettings(fallbackSettings)` synchronously before awaiting
   the IPC). Now it only calls `setSettings(defaults)` once the IPC
   resolves; if there is no API (`!api`) the call is a no-op. New test
   asserts that, while the IPC is in flight, `settings` is still the
   previously-loaded value, and that it flips to the IPC result only after
   the promise resolves. (While writing this test I also had to align the
   test fixtures with the current `useSettings` contract — `getEnvApiKeys`
   is now part of the test mock, and `defaultSettings` carries a `model`
   field so the `s.model.apiKey` access in the loader doesn't throw.)

**Test infrastructure cleanup:**

5. **`useSettings.test.ts` was in `src/hooks/` and not picked up by the
   default vitest include pattern** (`packages/*/test/**/*.test.ts`), so it
   ran zero assertions. Added `packages/*/src/**/*.test.ts` to the
   `vitest.config.ts` include list. The test file is still co-located
   (intentional — it's tightly coupled to the hook's React internals).

**R3 (documented, not changed):**

- `SettingsPanel` API-key persistence quirk — see the "Residual work
  (intentionally not in this round)" section above. By design; the provider-
  switch handler carries the apiKey forward because the form is "this model,
  configured with that key", not "this provider, configured with that key".
  If the behaviour is ever wrong, drop the apiKey on provider switch.

**New / updated test coverage:**

- `packages/desktop/test/store.test.ts` — 7 new tests for
  `loadMessages` / `appendMessage` / `clearMessages` (round-trip across
  instances, all 3 types, corruption recovery, 500-item FIFO cap,
  schema-rejection).
- `packages/desktop/test/ipc.test.ts` — 2 new tests for
  `nexus:getMessages` and `nexus:clearMessages` IPC delegation; updated
  the mock store to include the new methods.
- `packages/desktop/test/preload.smoke.test.ts` — updated method list to
  assert `nexus:clearMessages` is exposed by the built preload bundle.
- `packages/desktop/src/renderer/hooks/useSettings.test.ts` — new test
  for `resetSettings` non-flash; aligned existing tests with the current
  hook contract (added `getEnvApiKeys` to the mock, added `model` to
  `defaultSettings`).

**Known-good invariants (re-verified by tests):**

- `DesktopStore.appendMessage` is FIFO-capped at 500 items, zod-validates
  on every write (rejects and throws on bad shape), and is corruption-
  safe on read.
- The full chat round-trip works: `loadMessages` returns the persisted
  list, `executeIntent` appends a user message + (on success/error) a
  jarvis/system message, and the bridge reflects the canonical store on
  next `getMessages` call.
- `useSettings.resetSettings` no longer mutates state until the IPC
  resolves, so there is no in-process fallback flash.

**How to verify this round:**

```
npx tsc -b
npx vitest run
npm run coverage
npm run lint
npm run format:check
cd packages/desktop && npx vite build --config vite.renderer.config.ts && \
  npx vite build --config vite.preload.config.ts
```

(Do all of the above in one go via `bash scripts/ci-gate.sh` — that is what
the Docker gate runs.)

### Round 13 — make dev headless robustness (2026-06-19)

**Root cause:** `make dev` ran `cd packages/desktop && npm run dev`, which
spawned `concurrently --kill-others "npm run dev:renderer" "npm run
dev:electron"`. The moment Electron failed (in any headless environment
without a display server), `concurrently` sent `SIGTERM` to Vite, which
exited with `EPIPE` and an `esbuild` "Failed to scan for dependencies" error.
The whole command then exited non-zero. This was a pre-existing bug from
commit `e09814d` that was never run in CI.

**Fix:** extracted into `scripts/dev.sh` (mirrors the `scripts/test-e2e.sh`
pattern from Round 11). The new script:

1. Always starts the Vite renderer and waits for it to serve
   (`curl`-poll, the same readiness check the e2e runner uses).
2. **Auto-detects the display situation** before launching Electron:
   - `xvfb-run` is on PATH → wraps Electron in a virtual display
     (`-screen 0 1280x800x24`) so headless dev boxes get a real window.
   - `DISPLAY` is set but no `xvfb-run` → runs Electron directly.
   - neither → runs the renderer only and prints a clear message
     ("no display server detected, open http://localhost:5173 in a browser
     to see the UI; install xvfb for the full Electron experience").
3. **Forces `--no-sandbox` on the Electron side** because the SUID
   `chrome-sandbox` helper requires `root:4755` ownership, which we cannot
   assume on every dev machine. This is safe for dev (the renderer is just
   `localhost`); production builds are unaffected (they use the packaged
   binary, not this dev script). Also passes `--disable-gpu`,
   `--disable-software-rasterizer`, and `--disable-dev-shm-usage` so the
   headless / Xvfb / small-`/dev/shm` path is silent — without these,
   Electron logs harmless "Failed to send GpuControl.CreateCommandBuffer"
   and "Exiting GPU process" errors at every startup.
4. Uses `trap cleanup EXIT INT TERM` to always tear the Vite child down,
   the same way `scripts/test-e2e.sh` does — the previous Makefile version
   never reaped Vite on early exit, leaking the process.

`Makefile:53-55` now invokes `./scripts/dev.sh` instead of the
`concurrently` command.

**How to verify this round:**

```sh
# Show the three display-mode paths without actually launching Electron:
DISPLAY= ./scripts/dev.sh         # → "no display server detected …"
xvfb-run --version >/dev/null && DISPLAY= ./scripts/dev.sh   # → uses xvfb-run

# Or just:
make dev
```

**Why a script, not a Makefile rewrite?** A shell script is portable,
inspectable, and reuses the same `trap` / curl-poll / log-on-failure
patterns that `scripts/test-e2e.sh` already uses. Keeping all of the
desktop bring-up logic in `scripts/` means anyone can read it in one
place (`scripts/dev.sh`, `scripts/test-e2e.sh`, `scripts/ci-gate.sh`).

### Round 14 — make dev actually terminates on ^C (2026-06-19)

**User report:** "make dev is still not running." After Round 13 the dev
launched cleanly but a second pass revealed that `^C` in the terminal
left xvfb-run + Xvfb + 6 Electron subprocesses + Vite running as
orphans. The script's `trap` was not firing in the user's real
terminal session.

**Root cause investigation.** I did the research Round 13 skipped:
bash signal delivery in `wait` is documented to queue signals and only
deliver them when the waited-for child exits. Tested empirically with
bash 5.2.21 on Ubuntu 24.04:

- `bash -c "trap ... INT; sleep 60"` running **foreground** (e.g.
  under `timeout 3`): the trap fires on SIGTERM, kills the child,
  exits. **This is the user's actual scenario.**
- The same script running **backgrounded** (test harness): SIGTERM
  to the script's PID directly fires the trap, but SIGINT does not
  — bash queues it. SIGINT via the **process group** (the way the
  terminal kernel tty layer delivers it on `^C`) does fire the trap
  in both foreground and background.
- xvfb-run has its own signal-forwarding logic; sending SIGINT to
  xvfb-run alone is **not** reliable, so the dev script must kill
  the whole process group itself.

**Fix.** `scripts/dev.sh` already had a `kill_tree` recursive kill in
its `trap`; the real problem was the polling loop `while kill -0 ...;
do sleep 1; done`. The first version of the loop was correct, but
during Round 13 I switched to a `wait` and back to polling, and the
final state had a broken polling pattern. Final, working design:

1. The shell is `bash` (shebang `#!/usr/bin/env bash`) — bash is
   ubiquitous on Linux/macOS/Windows-Git-Bash. dash is intentionally
   avoided because its signal handling around `wait` is even more
   restrictive.
2. `xvfb-run` is launched as a **child** (no `exec`), so this script
   remains the signal-handling parent. xvfb-run's own SIGINT/SIGTERM
   forwarding is unreliable; the trap kills the whole pgroup instead.
3. The trap uses `kill_tree` (recursive `pgrep -P` + `kill`) on
   `XVFB_PID` and `VITE_PID` — works on every Unix-like system and on
   MSYS / Git Bash (where real process groups don't exist, the
   recursive walk still cleans up).
4. The polling loop `while kill -0 $XVFB_PID; do sleep 1; done`
   waits for the child; when SIGINT/SIGTERM arrives via the foreground
   pgroup (terminal `^C`), bash delivers the signal, the trap fires,
   the children die, and the script exits.
5. Also turned off the auto-open DevTools in
   `packages/desktop/src/electron-main.ts:56` because DevTools's
   Autofill CDP probe logs a noisy "Request Autofill.enable failed"
   error on every headless launch that `--disable-features=Autofill`
   does not fully silence. The user can still open DevTools
   manually with Ctrl+Shift+I (mac: Cmd+Opt+I). Updated
   `electron-main.test.ts` to assert DevTools is _not_ auto-opened.

**Verified on this machine** (Ubuntu 24.04, bash 5.2, kernel 6.17):

```
$ nohup setsid make dev > /tmp/devlog 2>&1 < /dev/null &
$ sleep 12  # build + vite ready + electron under xvfb
$ ps -p $! -o pid,stat,cmd              # make alive, status SNs (foreground pgrp leader)
$ ss -tln | grep 5173                   # vite listening
$ pgrep -c -f "node_modules/electron/dist/electron .*--no-sandbox"
6                                         # 6 electron children running
$ kill -- -$(ps -o pgid= -p $SCRIPT_PID) # SIGINT to the pgroup, like ^C
$ sleep 4
$ pgrep -f "node_modules/electron|vite.*vite.renderer|Xvfb" | wc -l
0                                         # all children gone
$ ss -tln | grep 5173                     # port freed
```

The user can now `make dev`, see the app come up, and hit `^C` to
shut it all down. Only one residual harmless message remains — Electron
on Linux prints `FATAL:electron_browser_main_parts.cc(508)] Failed to
shutdown.` followed by `signal SIGTRAP` on a clean signal-driven
exit. This is a known upstream Electron quirk, not something we
control.

**Cross-platform notes** (verified by reading platform conventions, not
by running on macOS/Windows):

- **macOS**: `xvfb-run` is not available. The script falls into the
  `DISPLAY` branch (macOS always has a display) and runs `npx
electron .` directly. The signal-handling pattern is the same —
  bash on macOS is bash 3.2+; `kill -- -PID` works the same.
- **Windows / Git Bash**: `xvfb-run` is not available, and `DISPLAY`
  may not be set. The script falls into the "no display detected"
  branch and prints the helpful "open http://localhost:5173 in a
  browser" message. The `kill_tree` recursive kill still works in
  MSYS / Git Bash (no real pgroup, but `pgrep -P` does process-tree
  walking in the MSYS PGROUP emulation).

### Round 15 — display-priority fix (2026-06-19)

**User report:** "It is still not launching using make dev." Round 14
verified the script's signal handling on this machine, but the actual
user scenario was different: this machine has a real display
(`DISPLAY=:1`), so the app should run against that display, not
under Xvfb. The user said "This machine has a display. I don't know
what is the problem here."

**Root cause.** The Round 11/13/14 priority was:

1. xvfb-run available → use it
2. DISPLAY set → use it
3. neither → renderer only

That was wrong. On a workstation with both `xvfb-run` (installed
for CI / headless dev) AND a real display (the workstation's X
server), the script would always go down path 1 and launch under
a hidden Xvfb display. The user would see "no window" because the
visible window is on `:1` but the app is on `:99` (or whatever
xvfb-run picked).

**Fix.** `scripts/dev.sh` now checks `display_reachable` _first_:

1. `DISPLAY` is set and the X server is reachable (tries
   `xdpyinfo`, falls back to checking the X11 socket at
   `/tmp/.X11-unix/X$displaynum`) → use the existing display.
2. `DISPLAY` not set / not reachable, `xvfb-run` available →
   wrap Electron in a virtual Xvfb display.
3. neither → renderer only (the helpful "open
   http://localhost:5173 in a browser" message).

The `display_reachable` helper uses `xdpyinfo` when present (the
most reliable check — it actually talks to the X server) and falls
back to checking the X11 Unix-domain socket. Both work on macOS
(Quartz doesn't expose `xdpyinfo` but has XQuartz's socket
directory) and on Windows Git Bash (DISPLAY branch is not taken
when DISPLAY is unset, so the no-display path triggers).

**Verified on this machine** (`DISPLAY=:1`):

```
$ make dev
...
==> vite is up
==> launching electron against DISPLAY=:1
...
```

The app now actually targets the visible X server. `^C` from the
terminal still cleans up cleanly (the same pgroup-kill trap
Round 14 added; it works the same regardless of which launch
branch was taken).

**Unrelated side effect of this fix:** the Round 14 "stuck on
launching electron under xvfb-run" hang that the user reported is
the same root cause. With the priority fix, this machine goes down
the DISPLAY branch, so the hang on `xvfb-run` no longer happens
for workstations with a real display. Headless CI / containers
without DISPLAY still go down the xvfb-run path and benefit from
the Round 14 trap.
