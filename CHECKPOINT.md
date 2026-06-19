# OpenJarvis — checkpoint

> At-a-glance status for anyone (AI agent or human) picking up this project. Read this
> first, then [`AGENT.md`](AGENT.md) for how to work here. Detailed, authoritative
> trackers live under `docs/` and are linked below.
>
> **Last updated:** 2026-06-19 · **Default branch:** `main` (protected; required
> `docker-gate`) · **Tests:** 1334 passing / 32 skipped, typecheck/lint/format clean.
> **Current branch:** `feat/playwright-e2e` (ahead of `origin/feat/playwright-e2e` by 2 commits).

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

- **Tests:** 1334 passing / 32 skipped (190 files) — `vitest run`
- **Typecheck:** Clean (`tsc -b` passes)
- **Lint:** Clean (`eslint . --max-warnings 0` passes)
- **Format:** Clean (`prettier --check` passes)
- **Playwright (desktop-e2e):** onboarding + dashboard + chat non-LLM + settings all
  green; LLM-gated chat specs require `OLLAMA_API_KEY` (green by construction when set).
- **Branch:** `main` (all feature parity + gap fill + robustness work merged). Active
  feature work on `feat/playwright-e2e` (2 commits ahead of `origin/feat/playwright-e2e`).

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

