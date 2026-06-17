# OpenJarvis Feature Parity — Design Spec

> **Date:** 2026-06-17
> **Status:** Draft
> **Goal:** Implement missing user-facing features to achieve parity with OpenClaw, enabling migration.

## 1. Current State

**Built and working:**
- Core runtime (GroundingEngine, Audit, ToolRegistry, capability gates)
- Durable state (SQLite event-sourced, keyed audit)
- Memory (decay-aware recall, embeddings)
- Document processing (markdownify: HTML/CSV/JSON/XML/text → Markdown)
- Nexus Orchestrator (IntentRouter, AgentPool, Synthesizer, TaskBoard)
- Multi-device sync (Track B)
- Process Enforcement
- Desktop Electron app (settings, IPC, main-process wiring)
- Health check (`packages/state/src/health.ts`)
- Voice pipeline interfaces (SttEngine, WakeWordEngine, TtsEngine — mock only)
- Scheduler interface (SimpleScheduler — mock only)
- HTTP transport (`packages/core/src/models/http.ts`)

**Mock/stub only (interfaces exist, no real implementation):**
- Voice: SttEngine, WakeWordEngine, TtsEngine → all return hardcoded data
- Scheduler: SimpleScheduler → in-memory Map, no cron execution
- AgentPool: InProcessAgentPool → 6 hardcoded agents returning static data
- Nexus bridge: calendar, weather, browser agents → fake responses

**Completely missing:**
- Discord, Telegram, Email, Calendar, Notion, Browser automation, 1Password, Weather, Cron execution, Sub-agent spawning

## 2. Architecture

### 2.1 Design principle: Typed Tools, not prose skills

OpenClaw uses prose `SKILL.md` files that inject context into the model prompt. OpenJarvis uses **typed `ToolDefinition` objects** with Zod-validated args, capability gates, and never-throws execution. Each OpenClaw "skill" maps to one or more `ToolDefinition` registrations.

### 2.2 Package structure

| Package | Scope |
|---|---|
| `@openjarvis/channels` | Discord gateway, Telegram bot, session mapping |
| `@openjarvis/skills-email` | Gmail IMAP/SMTP, Microsoft Graph |
| `@openjarvis/skills-calendar` | Microsoft Graph Calendar |
| `@openjarvis/skills-notion` | Notion API client |
| `@openjarvis/skills-web` | web_fetch tool, Playwright browser automation |
| `@openjarvis/skills-weather` | Weather API (wttr.in or OpenWeatherMap) |
| `@openjarvis/skills-secrets` | 1Password CLI integration |
| `@openjarvis/cron` | Real cron execution (replaces SimpleScheduler) |
| `@openjarvis/jarvis` | OllamaSttEngine, real AgentPool, real Scheduler |

### 2.3 How tools register

Each skills package exports a `registerTools(registry: ToolRegistry)` function. The composition root (likely in `@openjarvis/jarvis` or a new `@openjarvis/app` package) calls these during startup.

```ts
// Example: @openjarvis/skills-email
import { ToolRegistry } from "@openjarvis/core";

export function registerEmailTools(registry: ToolRegistry): void {
  registry.register(emailDraftTool);
  registry.register(emailSendTool);
  registry.register(emailSearchTool);
  registry.register(emailReadTool);
}
```

### 2.4 Capability model

New capabilities needed:

| Capability | Tools that require it |
|---|---|
| `email:read` | email_search, email_read |
| `email:send` | email_draft, email_send |
| `calendar:read` | calendar_list, calendar_get_events |
| `calendar:write` | calendar_create, calendar_update, calendar_delete |
| `notion:read` | notion_query, notion_get |
| `notion:write` | notion_create, notion_update |
| `web:fetch` | web_fetch |
| `web:browse` | browser_navigate, browser_click, browser_screenshot |
| `channel:read` | discord_read, telegram_read |
| `channel:write` | discord_send, telegram_send |
| `secrets:read` | secrets_get |
| `weather:read` | weather_current, weather_forecast |

High-risk tools (email_send, discord_send, calendar_delete) require the **approval gate** (the Gate / `taint.ts`).

## 3. Feature Specifications

### 3.1 Discord Channel Integration

**Package:** `@openjarvis/channels`

**Gateway connection:**
- WebSocket connection to Discord Gateway via `discord.js`
- Bot token stored in `DesktopStore` settings (or Vault when available)
- Reconnection with exponential backoff
- Rate limit handling (429 responses → queue + retry)

**Session mapping:**
- One Discord guild = one OpenJarvis "space"
- One Discord channel = one session thread
- DMs = direct sessions with user
- Discord message IDs stored in event metadata for edit/delete tracking

**Tools registered:**
- `discord_send` (capability: `channel:write`, approval gate: YES)
- `discord_read` (capability: `channel:read`)
- `discord_search` (capability: `channel:read`)

**Events emitted to EventBus:**
- `discord.message_create`, `discord.message_update`, `discord.message_delete`
- `discord.reaction_add`, `discord.interaction_create`

**Files:**
```
packages/channels/
  src/
    discord/
      gateway.ts          # WebSocket connection lifecycle
      rest.ts             # Discord REST API wrapper
      session-mapper.ts   # Map Discord → OpenJarvis sessions
      commands.ts         # Slash command registration
      handlers/
        message-create.ts
        message-update.ts
        message-delete.ts
        reaction-add.ts
        interaction-create.ts
    telegram/
      bot.ts              # Telegram Bot API client
      session-mapper.ts
    types/
      channel.ts
      message.ts
      user.ts
    index.ts
  test/
    discord/
      gateway.test.ts
      session-mapper.test.ts
    telegram/
      bot.test.ts
```

### 3.2 Telegram Channel Integration

**Package:** `@openjarvis/channels` (same package)

- Bot API via long-polling (webhook mode optional)
- Same session mapping pattern as Discord
- Tools: `telegram_send`, `telegram_read`
- Same capability model

### 3.3 Email Integration

**Package:** `@openjarvis/skills-email`

**Gmail:**
- IMAP for reading (node-imap or custom)
- SMTP for sending (nodemailer)
- App password auth (stored in Vault/settings)
- Attachment handling (download via IMAP, send via SMTP)

**Microsoft Live/Outlook:**
- Microsoft Graph API for read and send
- OAuth2 device code flow for auth
- Token refresh with automatic retry
- Store tokens in Vault (encrypted)

**Unified interface:**
```ts
interface EmailClient {
  listFolders(): Promise<EmailFolder[]>;
  listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
  getMessage(id: string): Promise<EmailMessage>;
  send(draft: EmailDraft): Promise<string>;
  search(query: string): Promise<EmailMessage[]>;
}
```

**Tools registered:**
- `email_search` (capability: `email:read`)
- `email_read` (capability: `email:read`)
- `email_draft` (capability: `email:send`)
- `email_send` (capability: `email:send`, approval gate: YES)

### 3.4 Calendar Integration

**Package:** `@openjarvis/skills-calendar`

- Microsoft Graph API (shares auth with email)
- List calendars, list/create/update/delete events
- Handle recurring events
- Timezone support (default: Europe/Berlin, configurable)

**Tools registered:**
- `calendar_list` (capability: `calendar:read`)
- `calendar_get_events` (capability: `calendar:read`)
- `calendar_create` (capability: `calendar:write`)
- `calendar_update` (capability: `calendar:write`)
- `calendar_delete` (capability: `calendar:write`, approval gate: YES)

### 3.5 Notion Integration

**Package:** `@openjarvis/skills-notion`

- Official `@notionhq/client` SDK
- Query databases, create/update pages
- Handle rich text, properties, relations
- Integration token stored in Vault/settings

**Tools registered:**
- `notion_query` (capability: `notion:read`)
- `notion_get` (capability: `notion:read`)
- `notion_create` (capability: `notion:write`)
- `notion_update` (capability: `notion:write`)

### 3.6 Web Tools

**Package:** `@openjarvis/skills-web`

**web_fetch tool:**
- HTTP GET with configurable timeout
- HTML → Markdown conversion (uses existing `@openjarvis/markdownify`)
- Returns cleaned Markdown text
- Handles: HTML, JSON, plain text
- Rate limiting and caching

**Browser automation (Playwright):**
- Launch Chromium (headless or headed)
- Navigate, click, type, scroll, screenshot
- Multiple tab support
- Cookie/session management
- Page state extraction (accessibility tree)

**Tools registered:**
- `web_fetch` (capability: `web:fetch`)
- `browser_navigate` (capability: `web:browse`)
- `browser_click` (capability: `web:browse`)
- `browser_type` (capability: `web:browse`)
- `browser_screenshot` (capability: `web:browse`)

### 3.7 Weather

**Package:** `@openjarvis/skills-weather`

- wttr.in API (no API key needed) or OpenWeatherMap (free tier)
- Current conditions and forecast
- Location from user settings or explicit parameter

**Tools registered:**
- `weather_current` (capability: `weather:read`)
- `weather_forecast` (capability: `weather:read`)

### 3.8 Cron/Scheduler

**Package:** `@openjarvis/cron`

- Replaces `SimpleScheduler` mock with real execution
- Uses `node-cron` for cron expression parsing
- Jobs persisted in SQLite (JarvisStateStore)
- Job execution calls agent intent pipeline
- Job status tracking (pending, running, completed, failed)
- Wake events for agent

```ts
interface CronJob {
  id: string;
  name: string;
  cron: string;           // cron expression
  intent: string;         // agent intent to execute
  params: Record<string, unknown>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}
```

### 3.9 1Password Integration

**Package:** `@openjarvis/skills-secrets`

- Wraps `op` CLI for secret retrieval
- Service account token auth (stored in Vault)
- Secret reference syntax: `op://vault/item/field`
- Injects secrets into agent context on demand

**Tools registered:**
- `secrets_get` (capability: `secrets:read`, approval gate: YES)

### 3.10 Voice Pipeline (already designed)

Already has a design spec at `docs/specs/2026-06-17-conversational-voice-pipeline-design.md`:
- `OllamaSttEngine` in `@openjarvis/jarvis`
- `AudioRecorder` + `AmplitudeWakeWordEngine` in `@openjarvis/desktop`
- `useVoicePipeline` hook replacing `useAudioAnalysis`

No changes needed to this spec.

### 3.11 Sub-Agent Spawning

**Package:** `@openjarvis/jarvis` (extends existing)

- Replace `InProcessAgentPool` mock with real agent spawning
- `AgentSession` class: isolated execution context with its own ToolRegistry grant
- Fork mode: inherits parent context
- Isolated mode: fresh context
- Max concurrent agents: 3 (configurable)
- Max spawn depth: 2
- Timeout: configurable per-spawn (default 60s)

```ts
interface AgentSession {
  id: string;
  spawn(agentId: string, message: string, mode: 'fork' | 'isolated'): Promise<AgentResult>;
  yield(message: string): Promise<void>;
  cancel(): void;
}
```

## 4. Nexus Router Updates

The `RuleBasedRouter` currently maps intents to hardcoded mock agents. It needs to route to **real tools** instead:

```ts
// Current: "check_weather" → weather agent (mock)
// New: "check_weather" → weather_current tool (real)
```

The router should fall back to a general-purpose LLM agent when no specific tool matches.

## 5. Configuration

User config stored in `DesktopStore` settings (already persisted):

```json
{
  "channels": {
    "discord": { "token": "op://vault/discord-bot-token", "guilds": [] },
    "telegram": { "token": "op://vault/telegram-bot-token" }
  },
  "skills": {
    "email": {
      "gmail": { "imap": "imap.gmail.com", "smtp": "smtp.gmail.com" },
      "live": { "clientId": "...", "tenant": "consumers" }
    },
    "calendar": { "provider": "live" },
    "notion": { "token": "op://vault/notion-token" },
    "weather": { "provider": "wttr" }
  }
}
```

Secrets referenced via `op://` URIs are resolved through the 1Password integration. Until 1Password is connected, plain values are stored in the Vault.

## 6. Implementation Order

### Phase 1: Channels (enables Discord-first migration)
1. `@openjarvis/channels` — Discord gateway + REST + session mapping
2. Discord message handlers + slash commands
3. `@openjarvis/skills-web` — web_fetch tool (uses existing markdownify)

### Phase 2: Daily Workflows (enables email/calendar use)
4. `@openjarvis/skills-email` — Gmail + Live/Outlook
5. `@openjarvis/skills-calendar` — Microsoft Graph Calendar
6. `@openjarvis/skills-notion` — Notion API

### Phase 3: Automation & Infrastructure
7. `@openjarvis/cron` — Real scheduler replacing SimpleScheduler
8. `@openjarvis/skills-web` — Browser automation (Playwright)
9. `@openjarvis/skills-weather` — Weather API
10. `@openjarvis/skills-secrets` — 1Password integration

### Phase 4: Voice & Intelligence
11. Voice pipeline (per existing design spec)
12. Sub-agent spawning (real AgentPool)
13. Telegram channel

## 7. Testing Requirements

Each package must meet the 99% coverage gate:
- Unit tests with mocked external APIs (Discord, Graph, Notion, etc.)
- Integration tests with real API calls (behind feature flags or CI secrets)
- Docker gate must pass

## 8. Out of Scope

- Canvas (HTML dashboards) — P3, later
- Meme-maker, diagram-maker — P3, later
- VECNA migration — one-time script, not runtime
- Always-on voice listening — v2.0 of voice pipeline
- Multi-language STT — v3.0