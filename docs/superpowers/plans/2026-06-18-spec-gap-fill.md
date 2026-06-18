# Spec Gap Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all 15 gaps between the feature parity spec and current implementation.

**Architecture:** 5 phases — Core infrastructure first (approval gate, cron persistence, telegram mapper), then Discord rewrite (raw WS+REST), then browser expansion, then calendar+config enhancements, then mark high-risk tools. TDD throughout; each task has failing test → implementation → passing test.

**Tech Stack:** TypeScript, Vitest, Zod, ws (WebSocket), node-cron, @openjarvis/state (SqlDriver), Playwright, @openjarvis/core (ToolRegistry, Gate)

---

## File Structure

### New files

```
packages/core/src/tools/tool.ts                    # MODIFY: add approvalRequired, influencedBy
packages/core/src/tools/registry.ts                # MODIFY: add approval gate check
packages/core/test/tools/registry.test.ts          # MODIFY: add approval gate tests
packages/channels/src/discord/gateway.ts           # REWRITE: raw WebSocket gateway
packages/channels/src/discord/rest.ts              # REWRITE: rate-limited REST client
packages/channels/src/discord/commands.ts           # NEW: slash command registration
packages/channels/src/discord/handlers/
  message-create.ts                                # NEW
  message-update.ts                                # NEW
  message-delete.ts                                # NEW
  reaction-add.ts                                  # NEW
  interaction-create.ts                             # NEW
packages/channels/src/discord/types.ts              # MODIFY: add event + search types
packages/channels/src/discord/tools.ts              # MODIFY: add discord_search, approvalRequired
packages/channels/test/discord/gateway.test.ts      # REWRITE
packages/channels/test/discord/rest.test.ts         # REWRITE
packages/channels/test/discord/commands.test.ts     # NEW
packages/channels/test/discord/handlers/            # NEW directory
packages/channels/src/telegram/session-mapper.ts    # NEW
packages/channels/test/telegram/session-mapper.test.ts  # NEW
packages/skills-web/src/browser.ts                  # REWRITE: add type, cookies, a11y, tabs
packages/skills-web/src/browser-tools.ts            # MODIFY: add browser_type, browser_accessibility, tab tools
packages/skills-web/test/browser-tools.test.ts      # MODIFY: add tests for new tools
packages/skills-web/test/browser.test.ts            # NEW: BrowserAutomation unit tests
packages/cron/src/scheduler.ts                      # REWRITE: SqlCronStore-backed
packages/cron/src/store.ts                           # NEW: CronPersistence interface + SqlCronStore
packages/cron/test/scheduler.test.ts                # MODIFY: add persistence tests
packages/cron/test/store.test.ts                    # NEW: SqlCronStore tests
packages/skills-calendar/src/types.ts               # MODIFY: add recurrence to CreateEventInput, defaultTimezone to CalendarConfig
packages/skills-calendar/src/graph-calendar-client.ts  # MODIFY: map recurrence, use defaultTimezone
packages/skills-calendar/src/tools.ts                # MODIFY: add recurrence + timezone to schemas
packages/skills-calendar/test/calendar.test.ts       # MODIFY: add recurrence + timezone tests
packages/desktop/src/main/resolve-secrets.ts        # NEW: op:// auto-resolution
packages/desktop/test/resolve-secrets.test.ts       # NEW: resolve-secrets tests
```

### Modified files

```
packages/channels/package.json                      # REMOVE: discord.js dependency
packages/channels/src/index.ts                      # MODIFY: export new modules
packages/cron/package.json                          # ADD: @openjarvis/state dependency
packages/skills-web/src/index.ts                    # MODIFY: export new types
```

---

### Task 1: Add `approvalRequired` to ToolDefinition + Gate integration

**Files:**

- Modify: `packages/core/src/tools/tool.ts`
- Modify: `packages/core/src/tools/registry.ts`
- Modify: `packages/core/test/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test for approvalRequired gate**

In `packages/core/test/tools/registry.test.ts`, add:

```ts
import { requiresApproval, provenance, TaintError } from "@openjarvis/core";

// ... inside describe("ToolRegistry") ...

describe("approval gate", () => {
  const registry = new ToolRegistry();
  const taintedProvenance = provenance("external", "user-input");
  const safeProvenance = provenance("operator", "cli");

  registry.register({
    name: "dangerous_action",
    description: "A dangerous action",
    args: z.object({ target: z.string() }),
    result: z.object({ ok: z.boolean() }),
    capabilities: [{ name: "shell" }],
    approvalRequired: true,
    handler: async () => ({ ok: true }),
  });

  registry.register({
    name: "safe_read",
    description: "A safe read",
    args: z.object({ key: z.string() }),
    result: z.object({ value: z.string() }),
    capabilities: [{ name: "fs:read" }],
    handler: async () => ({ value: "data" }),
  });

  it("blocks approvalRequired tool when influenced by tainted content", async () => {
    const result = await registry.invoke(
      { id: "1", tool: "dangerous_action", args: { target: "file" } },
      { agentId: "a", capabilities: [{ name: "shell" }] },
      { agentId: "a", influencedBy: [taintedProvenance] },
    );
    assert.ok(!result.ok);
    assert.ok(result.error?.includes("approval"));
  });

  it("allows approvalRequired tool when influenced only by safe content", async () => {
    const result = await registry.invoke(
      { id: "2", tool: "dangerous_action", args: { target: "file" } },
      { agentId: "a", capabilities: [{ name: "shell" }] },
      { agentId: "a", influencedBy: [safeProvenance] },
    );
    assert.ok(result.ok);
  });

  it("allows non-approvalRequired tool regardless of taint", async () => {
    const result = await registry.invoke(
      { id: "3", tool: "safe_read", args: { key: "k" } },
      { agentId: "a", capabilities: [{ name: "fs:read" }] },
      { agentId: "a", influencedBy: [taintedProvenance] },
    );
    assert.ok(result.ok);
  });

  it("allows approvalRequired tool when no influencedBy", async () => {
    const result = await registry.invoke(
      { id: "4", tool: "dangerous_action", args: { target: "file" } },
      { agentId: "a", capabilities: [{ name: "shell" }] },
      { agentId: "a" },
    );
    assert.ok(result.ok);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/tools/registry.test.ts`
Expected: FAIL — `approvalRequired` not on `ToolDefinition`, `influencedBy` not on `ToolContext`

- [ ] **Step 3: Add `approvalRequired` to ToolDefinition and `influencedBy` to ToolContext**

In `packages/core/src/tools/tool.ts`:

```ts
import type { Provenance } from "../security/taint.js";

export interface ToolContext {
  agentId: string;
  traceId?: string;
  /** Provenance tags for content influencing this tool call. Used by the approval gate. */
  influencedBy?: Provenance[];
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  args: z.ZodType<TArgs>;
  result: z.ZodType<TResult>;
  capabilities: Capability[];
  /** If true, this tool requires approval when influenced by tainted content. */
  approvalRequired?: boolean;
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}
```

In `packages/core/src/tools/registry.ts`, add the approval gate check after capability check and before handler invocation:

```ts
import { requiresApproval } from "../security/taint.js";

// ... in invoke() method, after capability check ...

// The Gate: approval-required tools blocked when influenced by tainted content.
if (
  tool.approvalRequired &&
  ctx.influencedBy &&
  requiresApproval({
    sideEffecting: true,
    influencedBy: ctx.influencedBy,
  })
) {
  this.logger.log("warn", "approval_required", { tool: call.tool });
  return fail(
    call,
    `approval required: tool "${call.tool}" is side-effecting and influenced by tainted content`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/tools/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/tool.ts packages/core/src/tools/registry.ts packages/core/test/tools/registry.test.ts
git commit -m "feat(core): add approvalRequired gate to ToolDefinition and ToolRegistry"
```

---

### Task 2: Cron SQLite Persistence via JarvisStateStore

**Files:**

- Create: `packages/cron/src/store.ts`
- Create: `packages/cron/test/store.test.ts`
- Modify: `packages/cron/src/scheduler.ts`
- Modify: `packages/cron/src/types.ts`
- Modify: `packages/cron/package.json`

- [ ] **Step 1: Write the failing test for SqlCronStore**

In `packages/cron/test/store.test.ts`:

```ts
import { describe, it, assert } from "vitest";
import { SqlCronStore } from "../src/store.js";
import { openDatabase } from "@openjarvis/state";

describe("SqlCronStore", () => {
  function makeStore() {
    const db = openDatabase({ path: ":memory:" });
    db.exec(`CREATE TABLE cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      intent TEXT NOT NULL,
      params TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT NOT NULL
    )`);
    return new SqlCronStore(db);
  }

  it("saves and loads a job", () => {
    const store = makeStore();
    const job = {
      id: "test-1",
      name: "test job",
      cron: "0 * * * *",
      intent: "check_weather",
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    store.save(job);
    const loaded = store.loadAll();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, "test-1");
    assert.equal(loaded[0].name, "test job");
    assert.equal(loaded[0].params, undefined);
  });

  it("saves and loads a job with params", () => {
    const store = makeStore();
    const job = {
      id: "test-2",
      name: "test with params",
      cron: "0 * * * *",
      intent: "send_email",
      params: { to: "user@example.com" },
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    store.save(job);
    const loaded = store.loadAll();
    assert.equal(loaded[0].params?.to, "user@example.com");
  });

  it("updates a job", () => {
    const store = makeStore();
    const job = {
      id: "test-3",
      name: "test job",
      cron: "0 * * * *",
      intent: "check_weather",
      enabled: true,
      createdAt: new Date().().toISOString(),
    };
    store.save(job);
    store.update({ ...job, name: "updated", enabled: false, lastRun: "2026-01-01T00:00:00Z" });
    const loaded = store.loadAll();
    assert.equal(loaded[0].name, "updated");
    assert.equal(loaded[0].enabled, false);
    assert.equal(loaded[0].lastRun, "2026-01-01T00:00:00Z");
  });

  it("removes a job", () => {
    const store = makeStore();
    const job = {
      id: "test-4",
      name: "test job",
      cron: "0 * * * *",
      intent: "check_weather",
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    store.save(job);
    store.remove("test-4");
    assert.equal(store.loadAll().length, 0);
  });

  it("returns false when removing non-existent job", () => {
    const store = makeStore();
    assert.equal(store.remove("nonexistent"), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/cron/test/store.test.ts`
Expected: FAIL — `SqlCronStore` not found

- [ ] **Step 3: Create `packages/cron/src/store.ts`**

```ts
import type { SqlDriver } from "@openjarvis/state";
import type { CronJob } from "./types.js";

export interface CronPersistence {
  save(job: CronJob): void;
  update(job: CronJob): void;
  remove(id: string): boolean;
  loadAll(): CronJob[];
}

export class SqlCronStore implements CronPersistence {
  constructor(private readonly db: SqlDriver) {}

  save(job: CronJob): void {
    this.db
      .prepare(
        `INSERT INTO cron_jobs (id, name, cron, intent, params, enabled, last_run, next_run, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id,
        job.name,
        job.cron,
        job.intent,
        job.params !== undefined ? JSON.stringify(job.params) : null,
        job.enabled ? 1 : 0,
        job.lastRun ?? null,
        job.nextRun ?? null,
        job.createdAt,
      );
  }

  update(job: CronJob): void {
    this.db
      .prepare(
        `UPDATE cron_jobs SET name=?, cron=?, intent=?, params=?, enabled=?, last_run=?, next_run=? WHERE id=?`,
      )
      .run(
        job.name,
        job.cron,
        job.intent,
        job.params !== undefined ? JSON.stringify(job.params) : null,
        job.enabled ? 1 : 0,
        job.lastRun ?? null,
        job.nextRun ?? null,
        job.id,
      );
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM cron_jobs WHERE id=?").run(id);
    return result.changes > 0;
  }

  loadAll(): CronJob[] {
    const rows = this.db.prepare("SELECT * FROM cron_jobs").all() as Record<string, unknown>[];
    return rows.map((row) => {
      const job: CronJob = {
        id: row.id as string,
        name: row.name as string,
        cron: row.cron as string,
        intent: row.intent as string,
        enabled: (row.enabled as number) === 1,
        createdAt: row.created_at as string,
      };
      if (row.params !== null && row.params !== undefined) {
        job.params = JSON.parse(row.params as string);
      }
      if (row.last_run !== null && row.last_run !== undefined) {
        job.lastRun = row.last_run as string;
      }
      if (row.next_run !== null && row.next_run !== undefined) {
        job.nextRun = row.next_run as string;
      }
      return job;
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/cron/test/store.test.ts`
Expected: PASS

- [ ] **Step 5: Modify `CronScheduler` to use `CronPersistence`**

Update `packages/cron/src/scheduler.ts`:

```ts
import cron from "node-cron";
import type { CronJob, CronJobCreate } from "./types.js";
import type { CronPersistence } from "./store.js";

export type OnTickCallback = (job: CronJob) => Promise<void>;

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private tasks = new Map<string, cron.ScheduledTask>();
  private readonly onTick: OnTickCallback | undefined;
  private readonly store: CronPersistence | undefined;

  constructor(opts?: { onTick?: OnTickCallback; store?: CronPersistence }) {
    this.onTick = opts?.onTick;
    this.store = opts?.store;
  }

  async schedule(input: CronJobCreate): Promise<CronJob> {
    if (!cron.validate(input.cron)) {
      throw new Error(`invalid cron expression: ${input.cron}`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job: CronJob = {
      id,
      name: input.name,
      cron: input.cron,
      intent: input.intent,
      enabled: input.enabled ?? true,
      createdAt: now,
    };
    if (input.params !== undefined) {
      job.params = input.params;
    }

    if (job.enabled) {
      const task = cron.schedule(job.cron, async () => {
        const updated = this.jobs.get(job.id);
        if (!updated) return;
        updated.lastRun = new Date().toISOString();
        if (this.store) {
          this.store.update(updated);
        }
        if (this.onTick) {
          await this.onTick(updated);
        }
      });
      this.tasks.set(id, task);
    }

    this.jobs.set(id, job);
    if (this.store) {
      this.store.save(job);
    }
    return { ...job };
  }

  async list(): Promise<CronJob[]> {
    return Array.from(this.jobs.values()).map((j) => ({ ...j }));
  }

  async cancel(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
    const deleted = this.jobs.delete(id);
    if (deleted && this.store) {
      this.store.remove(id);
    }
    return deleted;
  }

  /** Load persisted jobs from store and re-register them. */
  async restore(): Promise<void> {
    if (!this.store) return;
    const persisted = this.store.loadAll();
    for (const job of persisted) {
      this.jobs.set(job.id, job);
      if (job.enabled) {
        const task = cron.schedule(job.cron, async () => {
          const updated = this.jobs.get(job.id);
          if (!updated) return;
          updated.lastRun = new Date().toISOString();
          this.store.update(updated);
          if (this.onTick) {
            await this.onTick(updated);
          }
        });
        this.tasks.set(job.id, task);
      }
    }
  }
}
```

- [ ] **Step 6: Add `@openjarvis/state` dependency to cron package.json**

Update `packages/cron/package.json` dependencies to add:

```json
"@openjarvis/state": "*"
```

- [ ] **Step 7: Add cron_jobs migration to state schema**

In `packages/state/src/schema.ts`, add a new migration:

```ts
{
  version: 3,
  name: "cron_jobs",
  up: `
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
  `,
  down: `DROP TABLE IF EXISTS cron_jobs`,
},
```

- [ ] **Step 8: Update existing scheduler tests**

In `packages/cron/test/scheduler.test.ts`, add test for `restore()`:

```ts
it("restores persisted jobs from store", async () => {
  const savedJobs: CronJob[] = [];
  const mockStore: CronPersistence = {
    save: (job) => {
      savedJobs.push(job);
    },
    update: () => {},
    remove: () => true,
    loadAll: () => savedJobs,
  };
  const scheduler = new CronScheduler({ store: mockStore });
  await scheduler.schedule({ name: "test", cron: "* * * * *", intent: "check" });
  assert.equal(savedJobs.length, 1);

  const scheduler2 = new CronScheduler({ store: mockStore });
  await scheduler2.restore();
  const jobs = await scheduler2.list();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].name, "test");
});
```

- [ ] **Step 9: Run all cron tests**

Run: `npx vitest run packages/cron`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/cron packages/state/src/schema.ts
git commit -m "feat(cron): add SQLite persistence via SqlCronStore and restore-on-startup"
```

---

### Task 3: Telegram Session Mapper

**Files:**

- Create: `packages/channels/src/telegram/session-mapper.ts`
- Create: `packages/channels/test/telegram/session-mapper.test.ts`
- Modify: `packages/channels/src/telegram/bot.ts` (wire session mapper)

- [ ] **Step 1: Write the failing test**

In `packages/channels/test/telegram/session-mapper.test.ts`:

```ts
import { describe, it, assert } from "vitest";
import { TelegramSessionMapper } from "../../src/telegram/session-mapper.js";

describe("TelegramSessionMapper", () => {
  it("maps DM to individual session", () => {
    const mapper = new TelegramSessionMapper();
    const sessionId = mapper.getOrCreateSession(12345, "private");
    assert.ok(sessionId.startsWith("telegram:dm:"));
    assert.equal(sessionId, "telegram:dm:12345");
  });

  it("maps group chat to shared session", () => {
    const mapper = new TelegramSessionMapper();
    const sessionId = mapper.getOrCreateSession(67890, "group");
    assert.ok(sessionId.startsWith("telegram:group:"));
    assert.equal(sessionId, "telegram:group:67890");
  });

  it("maps supergroup to shared session", () => {
    const mapper = new TelegramSessionMapper();
    const sessionId = mapper.getOrCreateSession(11111, "supergroup");
    assert.equal(sessionId, "telegram:group:11111");
  });

  it("returns same session for same chatId", () => {
    const mapper = new TelegramSessionMapper();
    const s1 = mapper.getOrCreateSession(12345, "private");
    const s2 = mapper.getOrCreateSession(12345, "private");
    assert.equal(s1, s2);
  });

  it("gets existing session", () => {
    const mapper = new TelegramSessionMapper();
    mapper.getOrCreateSession(12345, "private");
    const result = mapper.getSession(12345);
    assert.equal(result, "telegram:dm:12345");
  });

  it("returns undefined for unknown session", () => {
    const mapper = new TelegramSessionMapper();
    assert.equal(mapper.getSession(99999), undefined);
  });

  it("removes a session", () => {
    const mapper = new TelegramSessionMapper();
    mapper.getOrCreateSession(12345, "private");
    mapper.removeSession(12345);
    assert.equal(mapper.getSession(12345), undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/channels/test/telegram/session-mapper.test.ts`
Expected: FAIL

- [ ] **Step 3: Create `packages/channels/src/telegram/session-mapper.ts`**

```ts
const DM_PREFIX = "telegram:dm:";
const GROUP_PREFIX = "telegram:group:";

export class TelegramSessionMapper {
  private sessions = new Map<number, string>();

  getOrCreateSession(chatId: number, chatType: string): string {
    const existing = this.sessions.get(chatId);
    if (existing) return existing;

    const prefix = chatType === "private" || chatType === "channel" ? DM_PREFIX : GROUP_PREFIX;
    const sessionId = `${prefix}${chatId}`;
    this.sessions.set(chatId, sessionId);
    return sessionId;
  }

  getSession(chatId: number): string | undefined {
    return this.sessions.get(chatId);
  }

  removeSession(chatId: number): void {
    this.sessions.delete(chatId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/channels/test/telegram/session-mapper.test.ts`
Expected: PASS

- [ ] **Step 5: Wire session mapper into TelegramBot**

Update `packages/channels/src/telegram/bot.ts` — add session mapper integration to `onMessage` so that the session ID is computed from `chatId` and `chatType`.

- [ ] **Step 6: Export from `packages/channels/src/telegram/types.ts`** — add `TelegramSessionMapper` to the telegram module exports.

- [ ] **Step 7: Run all channels tests**

Run: `npx vitest run packages/channels`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/channels
git commit -m "feat(channels): add TelegramSessionMapper for chat-to-session routing"
```

---

### Task 4: Discord Raw WebSocket Gateway with Reconnection

**Files:**

- Rewrite: `packages/channels/src/discord/gateway.ts`
- Rewrite: `packages/channels/test/discord/gateway.test.ts`
- Modify: `packages/channels/package.json` (replace `discord.js` with `ws`)

This is a substantial rewrite. The new gateway uses raw WebSocket instead of discord.js.

- [ ] **Step 1: Update `packages/channels/package.json`**

Replace `"discord.js": "^14.16.0"` with `"ws": "^8.18.0"` and add `"@types/ws": "^8.5.0"` to devDependencies. Remove discord.js from peerDependencies.

- [ ] **Step 2: Write failing tests for gateway**

In `packages/channels/test/discord/gateway.test.ts`, test:

- Connects and sends IDENTIFY with token
- Sends HEARTBEAT after HELLO
- Reconnects with RESUME after disconnect
- Exponential backoff on reconnect failures
- Emits `message_create`, `message_update`, `message_delete`, `reaction_add`, `interaction_create` events

All tests use a mock WebSocket server.

- [ ] **Step 3: Implement `packages/channels/src/discord/gateway.ts`**

Raw WebSocket gateway with:

- OP code handling (0=dispatch, 1=heartbeat, 7=reconnect, 10=hello, 11=heartbeat_ack)
- Heartbeat at interval from HELLO
- Exponential backoff reconnection (1s initial, 60s max, ±25% jitter)
- Session resume (OP 6) on reconnect
- Event dispatch to handlers

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/channels/test/discord/gateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/channels
git commit -m "feat(channels): rewrite Discord gateway to raw WebSocket with reconnection"
```

---

### Task 5: Discord Rate-Limited REST Client

**Files:**

- Rewrite: `packages/channels/src/discord/rest.ts`
- Rewrite: `packages/channels/test/discord/rest.test.ts`

- [ ] **Step 1: Write failing tests for rate-limited REST**

In `packages/channels/test/discord/rest.test.ts`, test:

- Successful GET/POST requests
- 429 handling: respects `Retry-After` header
- Rate limit bucket tracking from response headers
- 5xx retry with exponential backoff (max 3)
- Search endpoint

- [ ] **Step 2: Implement `packages/channels/src/discord/rest.ts`**

```ts
interface RateLimitBucket {
  remaining: number;
  resetAt: number;
}

export class DiscordRest {
  private readonly baseUrl = "https://discord.com/api/v10";
  private buckets = new Map<string, RateLimitBucket>();
  private readonly maxRetries = 3;

  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async sendMessage(channelId: string, content: string): Promise<{ messageId: string }> { ... }
  async getChannel(channelId: string): Promise<DiscordChannelInfo> { ... }
  async searchMessages(channelId: string, query: string, limit?: number): Promise<DiscordMessage[]> { ... }
  async registerCommands(applicationId: string, guildId: string, commands: unknown[]): Promise<void> { ... }

  private async request(path: string, method: string, body?: unknown): Promise<Response> { ... }
  private async waitForBucket(bucketId: string): Promise<void> { ... }
  private async handleRateLimit(response: Response): Promise<void> { ... }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run packages/channels/test/discord/rest.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/channels/src/discord/rest.ts packages/channels/test/discord/rest.test.ts
git commit -m "feat(channels): rewrite Discord REST client with rate limiting and retry"
```

---

### Task 6: Discord Event Handlers (5 files)

**Files:**

- Create: `packages/channels/src/discord/handlers/message-create.ts`
- Create: `packages/channels/src/discord/handlers/message-update.ts`
- Create: `packages/channels/src/discord/handlers/message-delete.ts`
- Create: `packages/channels/src/discord/handlers/reaction-add.ts`
- Create: `packages/channels/src/discord/handlers/interaction-create.ts`
- Create: `packages/channels/test/discord/handlers/` (test files)

Each handler validates the raw Discord payload, maps it to our typed event, and returns it. They are pure functions, easy to test.

- [ ] **Step 1: Write failing tests for all 5 handlers**

Each handler test verifies payload mapping and validation.

- [ ] **Step 2: Implement all 5 handlers**

Each exports a single function: `mapMessageCreate(d: unknown): DiscordMessage`, etc.

- [ ] **Step 3: Update types.ts with event types**

Add `DiscordEvent` union type, `message_update`, `message_delete`, `reaction_add`, `interaction_create` event types.

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/channels/test/discord/handlers/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/channels/src/discord/handlers packages/channels/test/discord/handlers packages/channels/src/discord/types.ts
git commit -m "feat(channels): add Discord event handlers for message, reaction, interaction events"
```

---

### Task 7: Discord Slash Commands

**Files:**

- Create: `packages/channels/src/discord/commands.ts`
- Create: `packages/channels/test/discord/commands.test.ts`

- [ ] **Step 1: Write failing test**

Test `registerCommands` sends PUT request to Discord API with correct payload.

- [ ] **Step 2: Implement `packages/channels/src/discord/commands.ts`**

```ts
export interface SlashCommand {
  name: string;
  description: string;
  options?: unknown[];
}

export class DiscordCommandRegistrar {
  constructor(
    private readonly rest: DiscordRest,
    private readonly applicationId: string,
  ) {}

  async registerCommands(guildId: string, commands: SlashCommand[]): Promise<void> {
    await this.rest.registerCommands(this.applicationId, guildId, commands);
  }
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run packages/channels/test/discord/commands.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/channels/src/discord/commands.ts packages/channels/test/discord/commands.test.ts
git commit -m "feat(channels): add Discord slash command registration"
```

---

### Task 8: Discord Search Tool

**Files:**

- Modify: `packages/channels/src/discord/tools.ts`
- Modify: `packages/channels/src/discord/types.ts`
- Modify: `packages/channels/test/discord/tools.test.ts`

- [ ] **Step 1: Add search types to types.ts**

Add `DiscordSearchResult` type and `searchMessages` to `DiscordToolClients` interface.

- [ ] **Step 2: Write failing test for `discord_search` tool**

- [ ] **Step 3: Implement `createDiscordSearchTool` in tools.ts**

- [ ] **Step 4: Register in `registerDiscordTools`**

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/channels/test/discord/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/channels/src/discord/tools.ts packages/channels/src/discord/types.ts packages/channels/test/discord/tools.test.ts
git commit -m "feat(channels): add discord_search tool"
```

---

### Task 9: Browser — `browser_type` Tool

**Files:**

- Modify: `packages/skills-web/src/browser.ts`
- Modify: `packages/skills-web/src/browser-tools.ts`
- Modify: `packages/skills-web/test/browser-tools.test.ts`

- [ ] **Step 1: Write failing test for `browser_type`**

- [ ] **Step 2: Add `type(selector, text)` method to `BrowserAutomation` interface and `PlaywrightBrowserAutomation`**

- [ ] **Step 3: Add `createBrowserTypeTool` to browser-tools.ts**

- [ ] **Step 4: Register in `registerBrowserTools`**

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/skills-web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/skills-web
git commit -m "feat(skills-web): add browser_type tool for keyboard input"
```

---

### Task 10: Browser — Accessibility Tree Extraction

**Files:**

- Modify: `packages/skills-web/src/browser.ts`
- Modify: `packages/skills-web/src/browser-tools.ts`
- Modify: `packages/skills-web/test/browser-tools.test.ts`

- [ ] **Step 1: Write failing test for `browser_accessibility` tool**

- [ ] **Step 2: Add `AccessibilityNode` type and `accessibility()` method to `BrowserAutomation`**

```ts
export interface AccessibilityNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
}
```

- [ ] **Step 3: Implement `accessibility()` in `PlaywrightBrowserAutomation`** — calls `page.accessibility.snapshot()`

- [ ] **Step 4: Add `createBrowserAccessibilityTool`**

- [ ] **Step 5: Register in `registerBrowserTools`**

- [ ] **Step 6: Run tests**

Run: `npx vitest run packages/skills-web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/skills-web
git commit -m "feat(skills-web): add browser_accessibility tool for accessibility tree extraction"
```

---

### Task 11: Browser — Cookie/Session Management

**Files:**

- Modify: `packages/skills-web/src/browser.ts`
- Modify: `packages/skills-web/test/browser.test.ts`

- [ ] **Step 1: Write failing test for cookie management**

- [ ] **Step 2: Add cookie methods to `BrowserAutomation` and `PlaywrightBrowserAutomation`**

```ts
async getCookies(): Promise<Cookie[]>;
async setCookies(cookies: CookieInput[]): Promise<void>;
async clearCookies(): Promise<void>;
```

These use Playwright's `context.cookies()`, `context.addCookies()`, `context.clearCookies()`. Internal-only, no tool exposure.

- [ ] **Step 3: Run tests**

Run: `npx vitest run packages/skills-web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/skills-web
git commit -m "feat(skills-web): add cookie/session management to BrowserAutomation"
```

---

### Task 12: Browser — Multi-Tab Support

**Files:**

- Modify: `packages/skills-web/src/browser.ts`
- Modify: `packages/skills-web/src/browser-tools.ts`
- Modify: `packages/skills-web/test/browser-tools.test.ts`

- [ ] **Step 1: Write failing tests for tab management tools**

- [ ] **Step 2: Update `PlaywrightBrowserAutomation` to support multiple tabs**

Replace single `page` with `Map<string, Page>`. Add:

- `listTabs(): Promise<TabInfo[]>`
- `switchTab(tabId: string): Promise<void>`
- `closeTab(tabId: string): Promise<void>`

Update `navigate()`, `click()`, `type()`, `screenshot()`, `accessibility()` to accept optional `tabId` parameter.

- [ ] **Step 3: Add `createBrowserListTabsTool`, `createBrowserSwitchTabTool`, `createBrowserCloseTabTool`**

- [ ] **Step 4: Register all new tab tools**

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/skills-web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/skills-web
git commit -m "feat(skills-web): add multi-tab support and tab management tools"
```

---

### Task 13: Calendar — Recurring Events + Configurable Default Timezone

**Files:**

- Modify: `packages/skills-calendar/src/types.ts`
- Modify: `packages/skills-calendar/src/graph-calendar-client.ts`
- Modify: `packages/skills-calendar/src/tools.ts`
- Modify: `packages/skills-calendar/test/calendar.test.ts`

- [ ] **Step 1: Write failing tests**

- [ ] **Step 2: Add `recurrence` to `CreateEventInput` and `CalendarConfig.defaultTimezone`**

In `types.ts`, add:

```ts
export interface RecurrencePattern {
  pattern: "daily" | "weekly" | "monthly";
  interval: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  endDate?: string;
  occurrences?: number;
}

// Add to CreateEventInput:
recurrence?: RecurrencePattern;

// Add to CalendarConfig:
defaultTimezone?: string;
```

- [ ] **Step 3: Update `GraphCalendarClient` to map recurrence and use default timezone**

- [ ] **Step 4: Update tool schemas in `tools.ts`**

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/skills-calendar`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/skills-calendar
git commit -m "feat(skills-calendar): add recurring event creation and configurable default timezone"
```

---

### Task 14: Desktop — `op://` Auto-Resolution

**Files:**

- Create: `packages/desktop/src/main/resolve-secrets.ts`
- Create: `packages/desktop/test/resolve-secrets.test.ts`
- Modify: `packages/desktop/src/main/schemas.ts` (document op:// support)

- [ ] **Step 1: Write failing test for `resolveSecrets`**

```ts
import { describe, it, assert, vi } from "vitest";
import { resolveSecrets } from "../../src/main/resolve-secrets.js";

describe("resolveSecrets", () => {
  it("resolves op:// references in config", async () => {
    const mockClient = { read: vi.fn().mockResolvedValue("secret-value") };
    const config = { token: "op://vault/item/field", name: "test" };
    const result = await resolveSecrets(config, mockClient);
    assert.equal(result.token, "secret-value");
    assert.equal(result.name, "test");
    assert.equal(mockClient.read.mock.calls.length, 1);
    assert.equal(mockClient.read.mock.calls[0][0], "op://vault/item/field");
  });

  it("leaves non-op:// values unchanged", async () => {
    const mockClient = { read: vi.fn() };
    const config = { token: "plain-value", name: "test" };
    const result = await resolveSecrets(config, mockClient);
    assert.equal(result.token, "plain-value");
    assert.equal(mockClient.read.mock.calls.length, 0);
  });

  it("gracefully handles op CLI not available", async () => {
    const mockClient = {
      read: vi.fn().mockRejectedValue(new Error("1Password CLI (op) not found")),
    };
    const config = { token: "op://vault/item/field" };
    const result = await resolveSecrets(config, mockClient, { graceful: true });
    assert.equal(result.token, "op://vault/item/field");
  });

  it("resolves nested op:// references", async () => {
    const mockClient = {
      read: vi.fn().mockResolvedValueOnce("discord-token").mockResolvedValueOnce("telegram-token"),
    };
    const config = {
      channels: {
        discord: { token: "op://vault/discord/token" },
        telegram: { token: "op://vault/telegram/token" },
      },
    };
    const result = await resolveSecrets(config, mockClient);
    assert.equal(result.channels.discord.token, "discord-token");
    assert.equal(result.channels.telegram.token, "telegram-token");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/test/resolve-secrets.test.ts`
Expected: FAIL

- [ ] **Step 3: Create `packages/desktop/src/main/resolve-secrets.ts`**

```ts
import type { OpClient } from "@openjarvis/skills-secrets";

export interface ResolveSecretsOptions {
  /** If true, gracefully fall back to leaving op:// references unchanged when resolution fails. */
  graceful?: boolean;
}

export async function resolveSecrets<T>(
  config: T,
  opClient: Pick<OpClient, "read">,
  options: ResolveSecretsOptions = {},
): Promise<T> {
  return resolveValue(config, opClient, options) as Promise<T>;
}

async function resolveValue(
  value: unknown,
  opClient: Pick<OpClient, "read">,
  options: ResolveSecretsOptions,
): Promise<unknown> {
  if (typeof value === "string" && value.startsWith("op://")) {
    try {
      return await opClient.read(value);
    } catch {
      if (options.graceful) {
        return value;
      }
      throw new Error(`Failed to resolve secret: ${value}`);
    }
  }

  if (Array.isArray(value)) {
    const resolved = await Promise.all(value.map((v) => resolveValue(v, opClient, options)));
    return resolved;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const resolved = await Promise.all(
      entries.map(async ([k, v]) => [k, await resolveValue(v, opClient, options)] as const),
    );
    return Object.fromEntries(resolved);
  }

  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/desktop/test/resolve-secrets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/resolve-secrets.ts packages/desktop/test/resolve-secrets.test.ts
git commit -m "feat(desktop): add op:// auto-resolution for config secrets"
```

---

### Task 15: Mark High-Risk Tools with `approvalRequired`

**Files:**

- Modify: `packages/channels/src/discord/tools.ts`
- Modify: `packages/skills-email/src/tools.ts`
- Modify: `packages/skills-calendar/src/tools.ts`
- Modify: `packages/skills-secrets/src/tools.ts`

- [ ] **Step 1: Add `approvalRequired: true` to `discord_send`**

In `packages/channels/src/discord/tools.ts`, add to `createDiscordSendTool`:

```ts
approvalRequired: true,
```

- [ ] **Step 2: Add `approvalRequired: true` to `email_send`**

In `packages/skills-email/src/tools.ts`, add to `createEmailSendTool`:

```ts
approvalRequired: true,
```

- [ ] **Step 3: Add `approvalRequired: true` to `calendar_delete`**

In `packages/skills-calendar/src/tools.ts`, add to `createCalendarDeleteTool`:

```ts
approvalRequired: true,
```

- [ ] **Step 4: Add `approvalRequired: true` to `secrets_get`**

In `packages/skills-secrets/src/tools.ts`, add to the secrets_get tool:

```ts
approvalRequired: true,
```

- [ ] **Step 5: Update vitest coverage excludes if needed**

The existing test files for these tools may need updates if they mock ToolContext without `influencedBy`.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/channels/src/discord/tools.ts packages/skills-email/src/tools.ts packages/skills-calendar/src/tools.ts packages/skills-secrets/src/tools.ts
git commit -m "feat: mark high-risk tools with approvalRequired (discord_send, email_send, calendar_delete, secrets_get)"
```

---

### Task 16: Final Gate — Coverage, Typecheck, Lint, Format

- [ ] **Step 1: Run coverage gate**

Run: `npm run coverage`
Expected: All 4 metrics ≥ 99%

- [ ] **Step 2: Run typecheck**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Run format check**

Run: `npm run format:check`
Expected: No errors

- [ ] **Step 5: Fix any coverage gaps**

Add test files or update `vitest.config.ts` excludes as needed.

- [ ] **Step 6: Update vitest.config.ts excludes for new browser automation code**

The browser.ts file (with multi-tab, cookies, accessibility) requires Playwright and should likely remain excluded from unit test coverage since it's tested via mocks in browser-tools.test.ts.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix coverage gate and vitest excludes for new code"
```

---

### Task 17: Update Documentation and CHECKPOINT

- [ ] **Step 1: Update `CHECKPOINT.md`** with new status for all filled gaps.

- [ ] **Step 2: Update `docs/specs/2026-06-17-feature-parity-design.md`** — mark each gap as ✅ filled.

- [ ] **Step 3: Commit**

```bash
git add CHECKPOINT.md docs/specs/2026-06-17-feature-parity-design.md
git commit -m "docs: update CHECKPOINT and feature parity spec with gap fill status"
```
