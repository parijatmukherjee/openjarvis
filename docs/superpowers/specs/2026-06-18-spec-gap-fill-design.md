# Spec Gap Fill — Design Spec

> **Date:** 2026-06-18
> **Status:** Draft
> **Goal:** Fill all 15 gaps between the feature parity spec and current implementation.

## 1. Overview

15 gaps identified between the spec (`docs/specs/2026-06-17-feature-parity-design.md`) and implementation. This design addresses each.

## 2. Discord — Full Rewrite to Raw WebSocket + REST

**Package:** `@openjarvis/channels`

The current implementation uses `discord.js` for the gateway but lacks rate limiting, reconnection, event handlers, slash commands, and search. We'll rewrite to raw WebSocket + REST.

### 2.1 Gateway (`gateway.ts`)

Replace `discord.js` Client with raw WebSocket to Discord Gateway v10:

- Connect to `wss://gateway.discord.gg/?v=10&encoding=json`
- Heartbeat with sequence tracking (OP 1 heartbeat, OP 0 dispatch, OP 10 hello, OP 11 heartbeat ACK, OP 2 identify, OP 7 reconnect, OP 9 invalid session)
- Exponential backoff reconnection: initial 1s, max 60s, jitter ±25%
- Resume on reconnect using session ID + sequence (OP 6 resume)
- Emit structured events: `message_create`, `message_update`, `message_delete`, `reaction_add`, `interaction_create`

### 2.2 REST Client (`rest.ts`)

Replace simple `fetch` wrapper with a rate-limited REST client:

- Token-bucket rate limiter: 50 requests/1s per route, 5s for invalid requests
- Route-based bucket identification (reads `X-RateLimit-Bucket` header)
- 429 handling: respect `Retry-After` header, queue pending requests
- Retry on 5xx errors (max 3 attempts, exponential backoff)

### 2.3 Event Handlers (`handlers/`)

New files under `packages/channels/src/discord/handlers/`:

- `message-create.ts` — maps raw Discord MESSAGE_CREATE to `DiscordMessage`
- `message-update.ts` — maps MESSAGE_UPDATE
- `message-delete.ts` — maps MESSAGE_DELETE
- `reaction-add.ts` — maps MESSAGE_REACTION_ADD
- `interaction-create.ts` — maps INTERACTION_CREATE (slash commands)

Each handler validates the payload, maps to our typed event, and emits to an `EventBus`.

### 2.4 Slash Commands (`commands.ts`)

New file `packages/channels/src/discord/commands.ts`:

- `registerCommands(guildId)` — registers slash commands via REST PUT `/applications/{appId}/guilds/{guildId}/commands`
- `handleInteraction(payload)` — dispatches interaction to registered handlers
- Default commands: `/jarvis`, `/jarvis-help`

### 2.5 Search Tool

New tool `discord_search` in `tools.ts`:

- Calls `GET /channels/{channelId}/messages/search?query=...` (or falls back to `GET /channels/{channelId}/messages?limit=100` + client-side filter)
- Returns array of `DiscordMessage`
- Capability: `discord:read`

### 2.6 Files

```
packages/channels/src/discord/
  gateway.ts          # Raw WebSocket gateway with reconnection
  rest.ts             # Rate-limited REST client
  session-mapper.ts   # (unchanged)
  commands.ts         # Slash command registration + handling
  handlers/
    message-create.ts
    message-update.ts
    message-delete.ts
    reaction-add.ts
    interaction-create.ts
  tools.ts            # discord_send, discord_read, discord_search
  types.ts            # Extended with search + event types
```

## 3. Browser Automation — 4 Gaps

**Package:** `@openjarvis/skills-web`

### 3.1 `browser_type` Tool

Add `type(selector: string, text: string)` to `BrowserAutomation` interface and `PlaywrightBrowserAutomation`:

```ts
async type(selector: string, text: string): Promise<{ typed: boolean }>
```

New tool `browser_type` with args `{ selector: z.string(), text: z.string() }`, capability `web:browse`.

### 3.2 Cookie/Session Management

Add to `BrowserAutomation`:

- `getCookies(): Promise<Cookie[]>` — calls `context.cookies()`
- `setCookies(cookies: CookieInput[]): Promise<void>` — calls `context.addCookies()`
- `clearCookies(): Promise<void>` — calls `context.clearCookies()`

Persist cookies in a `Map<string, Cookie[]>` keyed by domain. On `navigate`, cookies for the target domain are applied before loading. This enables login persistence across browser sessions.

No tool exposure — cookies are managed internally by the browser context.

### 3.3 Accessibility Tree Extraction

Add `accessibility(): Promise<AccessibilityNode>` to `BrowserAutomation`:

```ts
async accessibility(): Promise<AccessibilityNode>
```

Calls `page.accessibility.snapshot()` and returns the tree. New tool `browser_accessibility`:

- Args: none
- Result: `AccessibilityNode` (recursive tree of role, name, value, children)
- Capability: `web:browse`

### 3.4 Multiple Tab Support

Replace single `page` with a `Map<string, Page>` keyed by tab ID:

- `navigate(url, tabId?)` — opens in existing tab or new tab
- `switchTab(tabId)` — switches active tab
- `listTabs()` — returns all open tabs
- `closeTab(tabId)` — closes a tab

Update `ensureBrowser` to use a `BrowserContext` that persists across tab operations. Tools gain optional `tabId` parameter.

### 3.5 Updated Interface

```ts
interface BrowserAutomation {
  navigate(url: string, tabId?: string): Promise<{ title: string; url: string; tabId: string }>;
  click(selector: string, tabId?: string): Promise<{ clicked: boolean }>;
  type(selector: string, text: string, tabId?: string): Promise<{ typed: boolean }>;
  screenshot(tabId?: string): Promise<{ data: string; mimeType: string }>;
  accessibility(tabId?: string): Promise<AccessibilityNode>;
  listTabs(): Promise<TabInfo[]>;
  switchTab(tabId: string): Promise<void>;
  closeTab(tabId: string): Promise<void>;
  close(): Promise<void>;
}
```

## 4. Cron — SQLite Persistence via JarvisStateStore

**Package:** `@openjarvis/cron`

### 4.1 Persistence

Replace `Map<string, CronJob>` with `JarvisStateStore`-backed persistence:

- Add `@openjarvis/state` as a dependency
- On `schedule()`: insert job into SQLite via state store
- On `cancel()`: delete from SQLite
- On startup: `list()` reads all persisted jobs and re-registers `node-cron` tasks
- On tick: update `lastRun` in SQLite

### 4.2 Interface

```ts
interface CronPersistence {
  save(job: CronJob): Promise<void>;
  update(job: CronJob): Promise<void>;
  remove(id: string): Promise<boolean>;
  loadAll(): Promise<CronJob[]>;
}
```

Implemented as a `SqlCronStore` that uses the same `SqlDriver` interface as `JarvisStateStore`.

### 4.3 Migration

Add a schema migration for the `cron_jobs` table:

```sql
CREATE TABLE cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron TEXT NOT NULL,
  intent TEXT NOT NULL,
  params TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT NOT NULL
);
```

## 5. Approval Gate — ToolDefinition Metadata

**Package:** `@openjarvis/core`

### 5.1 Add `approvalRequired` to ToolDefinition

Add an optional `approvalRequired` field to `ToolDefinition`:

```ts
interface ToolDefinition<TArgs, TResult> {
  name: string;
  description: string;
  args: z.ZodType<TArgs>;
  result: z.ZodType<TResult>;
  capabilities: Capability[];
  approvalRequired?: boolean;  // NEW: if true, Gate checks before execution
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}
```

### 5.2 Gate Integration

Update the tool execution path (in `ToolRegistry.execute`) to check `approvalRequired`:

- If `approvalRequired` is true and any `influencedBy` provenance is tainted, throw `TaintError`
- This reuses the existing `requiresApproval()` from `taint.ts`
- The `ToolContext` is extended with `influencedBy: Provenance[]` (default empty for operator-initiated calls)

### 5.3 Mark High-Risk Tools

Set `approvalRequired: true` on:

- `discord_send` — sends messages to external channels
- `email_send` — sends emails
- `calendar_delete` — deletes calendar events
- `secrets_get` — reads secrets (already marked in spec)

## 6. Calendar — Recurring Events + Timezone

**Package:** `@openjarvis/skills-calendar`

### 6.1 Recurring Events

Add `recurrence` to `CreateEventInput`:

```ts
interface CreateEventInput {
  // ... existing fields ...
  recurrence?: {
    pattern: "daily" | "weekly" | "monthly";
    interval: number;          // e.g., 2 = every 2 weeks
    daysOfWeek?: number[];     // 0=Sun, 1=Mon, ...
    daysOfMonth?: number[];
    endDate?: string;          // ISO date
    occurrences?: number;      // or N occurrences
  };
}
```

Map to Microsoft Graph `recurrence` pattern/range format in `graph-calendar-client.ts`.

### 6.2 Configurable Default Timezone

Add `defaultTimezone` to `CalendarConfig` (in `types.ts`):

```ts
interface CalendarConfig {
  getToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  defaultTimezone?: string;  // e.g., "Europe/Berlin", defaults to "UTC"
}
```

When `start.timeZone` or `end.timeZone` is not provided in `CreateEventInput`, use `defaultTimezone`.

## 7. Config — `op://` URI Auto-Resolution

**Package:** `@openjarvis/desktop`

### 7.1 Resolution in DesktopStore

Add a `resolveSecrets<T>(config: T): Promise<T>` function that:

1. Deep-walks the config object
2. Finds any string value starting with `op://`
3. Calls `OpClient.resolve(opUri)` to get the actual value
4. Returns a new object with resolved values

### 7.2 Timing

Resolution happens at startup when `DesktopStore` loads config, and on-demand when a config value is accessed. The `OpClient` is only invoked if `op` CLI is available and authenticated.

### 7.3 Fallback

If `op` CLI is not available, the `op://` reference is left as-is (the tool can still use `secrets_get` at runtime). No error thrown.

## 8. Telegram — Session Mapper

**Package:** `@openjarvis/channels`

### 8.1 `TelegramSessionMapper`

New file `packages/channels/src/telegram/session-mapper.ts`:

```ts
class TelegramSessionMapper {
  private sessions = new Map<number, string>(); // chatId -> sessionId

  getOrCreateSession(chatId: number, chatType: string): string;
  getSession(chatId: number): string | undefined;
  removeSession(chatId: number): void;
}
```

Maps Telegram chat IDs to OpenJarvis session IDs. DMs map to individual sessions, group chats map to shared sessions.

### 8.2 Integration

Wire `TelegramSessionMapper` into `TelegramBot.onMessage` so that incoming messages are routed to the correct session.

## 9. Capability Naming — Keep Per-Channel

The current implementation uses `discord:message`, `discord:read`, `telegram:message`, `telegram:read` instead of the spec's `channel:read`/`channel:write`. This is arguably more granular and better — it allows different capability grants per channel. **No change needed.**

## 10. Implementation Order

### Phase 1: Core Infrastructure
1. `@openjarvis/core` — Add `approvalRequired` to ToolDefinition + Gate integration
2. `@openjarvis/cron` — SQLite persistence
3. `@openjarvis/channels` — Telegram session mapper

### Phase 2: Discord Rewrite
4. `@openjarvis/channels` — Raw WebSocket gateway with reconnection
5. `@openjarvis/channels` — Rate-limited REST client
6. `@openjarvis/channels` — Event handlers (5 files)
7. `@openjarvis/channels` — Slash commands
8. `@openjarvis/channels` — `discord_search` tool

### Phase 3: Browser Expansion
9. `@openjarvis/skills-web` — `browser_type` tool
10. `@openjarvis/skills-web` — Accessibility tree
11. `@openjarvis/skills-web` — Cookie/session management
12. `@openjarvis/skills-web` — Multi-tab support

### Phase 4: Calendar + Config
13. `@openjarvis/skills-calendar` — Recurring events + timezone
14. `@openjarvis/desktop` — `op://` auto-resolution

### Phase 5: Mark High-Risk Tools
15. Set `approvalRequired: true` on `discord_send`, `email_send`, `calendar_delete`, `secrets_get`