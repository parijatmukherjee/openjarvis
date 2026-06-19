# OpenJarvis

> Your own AI-agent platform — a self-owned runtime with the Jarvis multi-agent
> orchestration pattern at its heart. Cross-platform (Windows / macOS / Linux),
> Telegram + Discord native, with a beautiful real-time dashboard.

OpenJarvis is a ground-up rebuild of the [`openclaw-hawkins`](../openclaw-hawkins)
orchestration pattern that **no longer rides on top of an external runtime**.
Instead of shelling out to `openclaw agent …`, OpenJarvis owns the whole stack:
the agent loop, the model adapters, the tool/skill engine, durable state, shared
memory, the chat channels, and the dashboard.

The headline goal: **make the runtime enforce what OpenClaw left to the model's
discretion** — tool-calling, grounding, state transitions, memory injection,
permissions, and concurrency. The model proposes; the runtime enforces. This is
how we kill the hallucination problem at the root.

## Status

> 📍 For an at-a-glance snapshot of what's built, in flight, and next, see
> [`CHECKPOINT.md`](CHECKPOINT.md). Contributors (AI or human) should start with
> [`AGENT.md`](AGENT.md).

🟢 **All 18 packages complete.** 1254 tests passing, typecheck/lint/format clean,
9 rounds of architecture + wiring audits with all issues resolved.

## What's built

### Core runtime

- **Event-sourced session core** — durable `DomainEvent` log, single-writer
  serialized turns, reducer-based state, deterministic replay.
- **The Lab — capability-gated tool registry** — default-deny, never-throws
  `ToolRegistry`, confused-deputy guard, Zod validation both directions.
- **Model adapters** — Ollama (local + cloud, one code path) and an
  OpenAI-compatible adapter, over an injectable HTTP seam; a `ScriptedAdapter` for
  deterministic replay. **the Vault** secret vault (encrypted `FileVault`).
- **The agent loop** — native tool-calling round-trip with a model-call budget.
- **GroundingEngine — the grounding engine** — `off`/`preferred`/`required`/`cited` modes;
  `required` rejects any answer before a successful qualifying tool call, `cited`
  verifies the structured answer's citations and numeric claims against the tool
  result, and the honest "unknown" is accepted.
- **Audit audit** + **the Gate** (taint → approval) + secret **redaction** — the audit
  is a **keyed HMAC** hash chain (tamper-evident, not just a checksum) under a Vault-held
  key, durable in SQLite and proven to verify across a process restart.
- **Durable by default at runtime** — `@openjarvis/state` (JarvisStateStore) wires the SQLite event
  store + keyed audit into a runnable entrypoint (`openjarvis-run`); a separate process
  reopens the db + Vault and the chain verifies.
- **Hardened for production correctness** — atomic crash-safe `FileVault`, guarded JSON parse,
  request timeouts + bounded retry, https-for-non-loopback, structured redacted logging,
  rate limiting, LRU eviction, and comprehensive error handling across all packages.
- **`ask` CLI + eval harness** — the same weak model, run `cited` vs `off`, rejects
  the fabricated "250 GB" guess and answers the real free-bytes vs lets the
  hallucination survive — proving the engine is the difference.

### Channels & integrations

- **Discord** — Raw WebSocket gateway with heartbeat + reconnection, rate-limited REST client,
  session mapper, slash commands, 5 event handlers, 3 tools (`discord_send`, `discord_read`,
  `discord_search`).
- **Telegram** — Bot with long-polling, exponential backoff, session mapper, 2 tools
  (`telegram_send`, `telegram_read`).
- **Email** — Gmail (IMAP/SMTP) + Microsoft Graph (OAuth2 device code flow, token refresh
  with mutex). 4 tools: `email_search`, `email_read`, `email_draft`, `email_send` (approval-gated).
- **Calendar** — Microsoft Graph Calendar with recurring events. 5 tools: `calendar_list`,
  `calendar_get_events`, `calendar_create`, `calendar_update`, `calendar_delete` (last 3 approval-gated).
- **Notion** — Notion API with 429 retry. 4 tools: `notion_query`, `notion_get`,
  `notion_create`, `notion_update`.
- **Weather** — wttr.in. 2 tools: `weather_current`, `weather_forecast`.
- **Secrets** — 1Password CLI. 1 tool: `secrets_get` (approval-gated).
- **Cron** — Real cron scheduler with SQLite persistence. 3 tools: `cron_schedule`,
  `cron_list`, `cron_cancel`.

### Browser & web

- **Web fetch** — URL → Markdown conversion with rate limiting.
- **Browser automation** — Playwright-based. 7 tools: `browser_navigate`, `browser_click`,
  `browser_type`, `browser_screenshot`, `browser_accessibility`, `browser_list_tabs`,
  `browser_switch_tab`, `browser_close_tab`. Cookie management, multi-tab support,
  concurrent init serialization.

### Nexus orchestrator

- **IntentRouter** — Rule-based intent parsing and routing (30+ intent actions → 14 specialist agents).
- **AgentPool** — In-process agent pool with timeout enforcement and capability matching.
- **Synthesizer** — Response synthesis from agent results.
- **NexusEngine** — Orchestration engine coordinating intent routing, parallel/sequential
  agent dispatch, and result synthesis.
- **TaskBoard** — Task tracking with LRU eviction (max 1000 tasks).
- **ReplayEngine** — Replay capability for orchestration sessions.

### Memory & state

- **JarvisMemoryStore** — Decay-aware memory with fragment recall, pure-JS vector embeddings
  (optional @huggingface/transformers), FTS5 lexical fallback, and `asMemoryStore` adapter
  bridging to the core `MemoryStore` interface.
- **JarvisStateStore** — Durable SQLite event store + keyed audit + migrations.
- **CronScheduler** — Real cron with `SqlCronStore` persistence, restore-on-restart, and
  error-resilient tick handling.

### Desktop & voice

- **Electron app** — Settings + user profile via typed IPC bridge, single-instance lock.
- **Voice pipeline** — AudioRecorder, AmplitudeWakeWordEngine with cooldown, useVoicePipeline hook.
- **op:// auto-resolution** — 1Password CLI integration for config secrets.

### Multi-device sync (Track-B)

- **Device identity** — Key pairs, pairing protocol, device registry.
- **CRDT sync** — Vector clocks, event/memory/vault sync.
- **Noise protocol** — Encrypted channel communication.

## The pieces

All 18 packages are built and tested:

| Package                | Role                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `core`                 | Runtime: agent loop, model adapters, native tool-calling, **GroundingEngine**, capability sandbox     |
| `state`                | Durable orchestration state (JarvisStateStore reborn) — runtime-owned, SQLite-default                 |
| `memory`               | Decay-aware shared memory (JarvisMemoryStore reborn) — auto-injected, SQLite-default                |
| `markdownify`          | Document → Markdown converters (CSV/HTML/JSON/XML/text) for token reduction — never-throws registry |
| `jarvis`               | The Nexus — routing, dispatch, synthesis, voice, vision, display, hub                               |
| `agents`               | Built-in specialist agents (vision, mock)                                                             |
| `desktop`              | Electron desktop app with voice pipeline and op:// resolution                                        |
| `track-b`              | Multi-device sync: device identity, CRDT, Noise protocol, task router, vault sync                     |
| `process`              | Process Enforcement: AGENT.md loop runtime enforcement                                                |
| `channels`             | Telegram + Discord native gateways with tools                                                         |
| `skills-web`           | Web fetch + browser automation tools                                                                  |
| `skills-email`         | Gmail + Graph email tools                                                                            |
| `skills-calendar`      | Microsoft Graph Calendar tools                                                                        |
| `skills-notion`        | Notion API tools                                                                                     |
| `skills-weather`       | wttr.in weather tools                                                                                |
| `skills-secrets`       | 1Password secrets tools                                                                              |
| `cron`                 | Cron scheduler with SQLite persistence                                                                |
| `skills`               | Skill manifest, loader, and sandbox infrastructure (plugin SDK foundation)                            |

## Stack

TypeScript everywhere, running on **Node and Bun** (the CI matrix runs both) · Astro
dashboard (planned) · embedded SQLite by default (no MariaDB requirement) · single
self-contained binary per OS.

## License

TBD (the source pattern is MIT).
