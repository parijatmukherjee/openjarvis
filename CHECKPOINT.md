# OpenJarvis — checkpoint

> At-a-glance status for anyone (AI agent or human) picking up this project. Read this
> first, then [`AGENT.md`](AGENT.md) for how to work here. Detailed, authoritative
> trackers live under `docs/` and are linked below.
>
> **Last updated:** 2026-06-18 · **Default branch:** `main` (protected; required
> `docker-gate`) · **Tests:** 1015 passing / 1 skipped, typecheck/lint/format clean.
> **Branch:** `discord-webfetch`

---

## 1. What this is

A self-owned AI-agent runtime with the Jarvis multi-agent orchestration pattern.
TypeScript monorepo, embedded SQLite, single self-contained binary, runs on Node and
Bun. Thesis: **the model proposes, the runtime enforces** (grounding, tool-calling,
state, capabilities). Full vision: [`docs/specs/2026-06-05-openjarvis-design.md`](docs/specs/2026-06-05-openjarvis-design.md).

## 2. Packages that exist today

| Package                   | Status | Role                                                                                                                                                                                                                   |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openjarvis/core`        | 🟢     | Agent loop, model adapters, tool registry (**the Lab**), **GroundingEngine** grounding, **Audit** audit, **the Vault** vault, **the Gate** taint/approval, redaction, structured logging, the Playbook process engine. |
| `@openjarvis/state`       | 🟢     | **JarvisStateStore**: durable SQLite (`SqlDriver` + migrations + event store + keyed audit store) and the durable composition root (`buildDurableAgentRun` + `openjarvis-run` CLI).                                    |
| `@openjarvis/memory`      | 🟢     | **JarvisMemoryStore**: decay-aware memory (fragments, recall, pure-JS embeddings + FTS5 fallback). **Wired into the agent path** via `buildAgentRun`/`buildDurableAgentRun`/`buildProbeAgent`.                         |
| `@openjarvis/markdownify` | 🟢     | Document → Markdown converters (CSV/HTML/JSON/XML/text) behind a never-throws `ConverterRegistry`. **Wired into the agent path** via `createDocumentTool` + `buildDurableAgentRun`/`buildProbeAgent`.                  |
| `@openjarvis/jarvis`      | 🟢     | Vision skill interfaces + E2E automation suite. **S3 Nexus Orchestrator** (IntentRouter, AgentPool, Synthesizer, NexusEngine, TaskBoard, ReplayEngine). **OllamaSttEngine** for voice transcription. **AgentSession** for sub-agent spawning. |
| `@openjarvis/agents`      | 🟢     | Built-in agents package with `VisionAgent`/`MockVisionAgent` (agent delegator, pool interfaces).                                                                                                                       |
| `@openjarvis/desktop`     | 🟢     | Electron desktop app. Settings + user profile persisted via typed IPC bridge. **Voice pipeline:** AudioRecorder, AmplitudeWakeWordEngine, useVoicePipeline hook. |
| `@openjarvis/track-b`     | 🟢     | Multi-device sync: device identity, CRDT sync, Noise protocol, task router, vault sync. 56 tests.                                                                                                                      |
| `@openjarvis/process`     | 🟢     | Process Enforcement: AGENT.md loop runtime enforcement with ProcessEngine, gate checks, lifecycle hooks, event bus. 57 tests.                                                                                          |
| `@openjarvis/channels`    | 🟢     | Discord gateway + REST + session mapper + tools (discord_send, discord_read). Telegram bot + tools (telegram_send, telegram_read). 55 tests. |
| `@openjarvis/skills-web`  | 🟢     | web_fetch tool (URL → Markdown) + browser automation tools (browser_navigate, browser_click, browser_screenshot). |
| `@openjarvis/skills-email`| 🟢     | Gmail (IMAP/SMTP) + Microsoft Graph (OAuth2 device code). 4 tools: email_search, email_read, email_draft, email_send. 61 tests. |
| `@openjarvis/skills-calendar` | 🟢 | Microsoft Graph Calendar. 5 tools: calendar_list, calendar_get_events, calendar_create, calendar_update, calendar_delete. |
| `@openjarvis/skills-notion`  | 🟢 | Notion API. 4 tools: notion_query, notion_get, notion_create, notion_update. |
| `@openjarvis/skills-weather` | 🟢 | wttr.in weather. 2 tools: weather_current, weather_forecast. |
| `@openjarvis/skills-secrets` | 🟢 | 1Password CLI. 1 tool: secrets_get. |
| `@openjarvis/cron`           | 🟢 | Real cron scheduler. 3 tools: cron_schedule, cron_list, cron_cancel. |

## 3. Feature Parity Status

All 13 features from the feature parity spec are now implemented:

| # | Feature | Package | Tools | Status |
|---|---------|---------|-------|--------|
| 1 | Discord channel | `@openjarvis/channels` | discord_send, discord_read | ✅ |
| 2 | Web fetch | `@openjarvis/skills-web` | web_fetch | ✅ |
| 3 | Email (Gmail + Graph) | `@openjarvis/skills-email` | email_search, email_read, email_draft, email_send | ✅ |
| 4 | Calendar (Graph) | `@openjarvis/skills-calendar` | calendar_list, calendar_get_events, calendar_create, calendar_update, calendar_delete | ✅ |
| 5 | Notion | `@openjarvis/skills-notion` | notion_query, notion_get, notion_create, notion_update | ✅ |
| 6 | Weather | `@openjarvis/skills-weather` | weather_current, weather_forecast | ✅ |
| 7 | Cron scheduler | `@openjarvis/cron` | cron_schedule, cron_list, cron_cancel | ✅ |
| 8 | Browser automation | `@openjarvis/skills-web` | browser_navigate, browser_click, browser_screenshot | ✅ |
| 9 | 1Password secrets | `@openjarvis/skills-secrets` | secrets_get | ✅ |
| 10 | Voice pipeline | `@openjarvis/jarvis` + `@openjarvis/desktop` | OllamaSttEngine, AudioRecorder, useVoicePipeline | ✅ |
| 11 | Sub-agent spawning | `@openjarvis/jarvis` | AgentSession | ✅ |
| 12 | Telegram | `@openjarvis/channels` | telegram_send, telegram_read | ✅ |
| 13 | Browser automation | (same as #8) | — | ✅ |

## 4. Gate status

- **Tests:** 1015 passing / 1 skipped
- **Typecheck:** Clean (`tsc -b` passes)
- **Lint:** Clean (`eslint .` passes)
- **Format:** Clean (`prettier --check` passes)
- **Branch:** `discord-webfetch` (all feature parity work)

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