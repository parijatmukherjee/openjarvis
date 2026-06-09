# Track A1b — Runtime Durable Cutover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the durable, keyed audit + event store actually take effect in a runnable entrypoint — closing **F-C1** (durability) and **F-C2** (keyed audit) _at runtime_, not just in the library. A1 built `SqliteEventStore` + `SqliteAuditLog`; A2 made the audit keyed HMAC under a Vault key. But the only entrypoint (`core/bin/run.ts`) still uses in-memory stores, because `core` cannot import `state` (dependency cycle). This adds the composition root in `packages/state` (which depends on `core`, so it may wire both): a `buildDurableAgentRun` helper + an `openhawkins-run` CLI that persists to SQLite with a Vault-keyed audit, plus a **black-box functional test** that runs the built binary and then reopens the DB in a fresh process to prove the keyed audit survives.

**Architecture:** `packages/state/src/build-durable-agent-run.ts` opens one `SqlDriver`, resolves the persistent audit HMAC key from a `FileVault` (`resolveAuditKey`), constructs `SqliteEventStore` + `SqliteAuditLog(db, key)`, and delegates to core's `buildAgentRun({ store, audit, ... })`. A sibling `verifyDurable` reopens an existing DB+Vault and reports `{ events, auditEntries, auditVerified }`. `packages/state/src/bin/openhawkins-run.ts` is the CLI (run mode + `--verify` mode). A functional test spawns the built CLI: run → then `--verify` in a separate process → asserts the keyed chain verifies across processes.

**Tech Stack:** TypeScript strict, ESM `.js` specifiers, Vitest, Node 24 + Bun 1.3. Prettier printWidth 100, double quotes.

**Review basis:** [`docs/reviews/2026-06-09-production-readiness-review.md`](../reviews/2026-06-09-production-readiness-review.md) — **A1b** (the runtime cutover the A1 + A2 reviews surfaced).

**Depends on (merged):**

- core: `buildAgentRun(opts)` accepts `store?`/`audit?`; `resolveAuditKey(vault): Promise<Buffer>`; `FileVault({path, passphrase})`; `ScriptedOperator`, `weakHostFactsModel`, `ValidateGate`, `isPhaseEvent`, `foldPlaybook`, `type PhaseEvent`.
- state: `openDatabase({path})`, `SqliteEventStore`, `SqliteAuditLog`.
- `packages/state` depends on `@openhawkins/core` (no cycle when state imports core); `src/bin/**` is coverage-excluded; functional tests live at `packages/state/test-functional/**/*.test.ts`.

**Conventions:** Unit tests `packages/state/test/...`. Coverage ≥99%; non-bin new src 100% (`bin/**` excluded). The CLI defaults to the scripted model + a trivial Validate so the demo is offline/deterministic (the durable stores, Vault key, and keyed audit are all REAL).

---

### Task 1: `buildDurableAgentRun` + `verifyDurable` helpers

**Files:**

- Create: `packages/state/src/build-durable-agent-run.ts`
- Modify: `packages/state/src/index.ts` (export them)
- Test: `packages/state/test/build-durable-agent-run.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/state/test/build-durable-agent-run.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedOperator, weakHostFactsModel, ValidateGate } from "@openhawkins/core";
import { buildDurableAgentRun, verifyDurable } from "../src/build-durable-agent-run.js";

const dir = () => mkdtempSync(join(tmpdir(), "oh-a1b-"));
const approvals = () =>
  new ScriptedOperator(
    Array.from({ length: 8 }, () => ({ approve: true as const, actor: "op", reason: "ok" })),
  );

describe("buildDurableAgentRun + verifyDurable", () => {
  it("persists a run to SQLite with a Vault-keyed audit; a fresh reopen verifies", async () => {
    const d = dir();
    const dbPath = join(d, "run.db");
    const vaultPath = join(d, "vault.json");
    const passphrase = "test-pass";

    const built = await buildDurableAgentRun({
      dbPath,
      vaultPath,
      passphrase,
      adapter: weakHostFactsModel(tmpdir()),
      grounding: "cited",
      prompts: { Execute: "How much disk space is free on this machine?" },
      operator: approvals(),
      validateGate: new ValidateGate(async () => ({ ok: true })),
    });
    expect(await built.run.run()).toEqual({ kind: "completed" });
    expect(await built.audit.verify()).toBe(true);
    built.close();

    // reopen the SAME db + vault with fresh objects (separate from the run above)
    const v = await verifyDurable({ dbPath, vaultPath, passphrase });
    expect(v.auditVerified).toBe(true);
    expect(v.events).toBeGreaterThan(0);
    expect(v.auditEntries).toBeGreaterThan(6); // agent turn + phase transitions
  });

  it("verifyDurable reports a clean (empty) db as verified with zero entries", async () => {
    const d = dir();
    const v = await verifyDurable({
      dbPath: join(d, "empty.db"),
      vaultPath: join(d, "vault.json"),
      passphrase: "p",
    });
    expect(v).toEqual({ events: 0, auditEntries: 0, auditVerified: true });
  });
});
```

- [ ] **Step 2: Run → fail** (cannot find module).

- [ ] **Step 3: Write `packages/state/src/build-durable-agent-run.ts`:**

```ts
import {
  buildAgentRun,
  resolveAuditKey,
  FileVault,
  type BuildAgentRunOpts,
  type BuiltAgentRun,
} from "@openhawkins/core";
import { openDatabase, type SqlDriver } from "./driver/driver.js";
import { SqliteEventStore } from "./event-store.js";
import { SqliteAuditLog } from "./audit-store.js";

/** Options for a durable agent run: the SQLite + Vault paths, plus the usual run opts
 *  (minus `store`/`audit`, which this wires). */
export interface DurableAgentRunOpts extends Omit<BuildAgentRunOpts, "store" | "audit"> {
  dbPath: string;
  vaultPath: string;
  passphrase: string;
}

/** A built durable run; `close()` releases the SQLite handle. */
export interface BuiltDurableAgentRun extends BuiltAgentRun {
  close(): void;
}

/**
 * The durable composition root (F-C1/F-C2 at runtime): one SQLite db holds the event
 * store AND the keyed audit; the audit HMAC key is resolved from a `FileVault` (minted on
 * first use). This package may import both `core` and `state` (state depends on core), so
 * the wiring `core` itself cannot do (cycle) lives here.
 */
export async function buildDurableAgentRun(
  opts: DurableAgentRunOpts,
): Promise<BuiltDurableAgentRun> {
  const { dbPath, vaultPath, passphrase, ...runOpts } = opts;
  const db = openDatabase({ path: dbPath });
  const key = await resolveAuditKey(new FileVault({ path: vaultPath, passphrase }));
  const store = new SqliteEventStore(db);
  const audit = new SqliteAuditLog(db, key);
  const built = await buildAgentRun({ ...runOpts, store, audit });
  return { ...built, close: () => closeDriver(db) };
}

/** Reopen an existing durable db + vault and report its event count, audit size, and
 *  whether the keyed audit chain verifies — the cross-process durability proof. */
export async function verifyDurable(opts: {
  dbPath: string;
  vaultPath: string;
  passphrase: string;
  sessionId?: string;
}): Promise<{ events: number; auditEntries: number; auditVerified: boolean }> {
  const db = openDatabase({ path: opts.dbPath });
  try {
    const key = await resolveAuditKey(
      new FileVault({ path: opts.vaultPath, passphrase: opts.passphrase }),
    );
    const store = new SqliteEventStore(db);
    const audit = new SqliteAuditLog(db, key);
    const events = (await store.read(opts.sessionId ?? "probe-agent-session")).length;
    const entries = await audit.entries();
    return { events, auditEntries: entries.length, auditVerified: await audit.verify() };
  } finally {
    closeDriver(db);
  }
}

function closeDriver(db: SqlDriver): void {
  db.close();
}
```

> If `BuildAgentRunOpts`/`BuiltAgentRun` aren't exported from the core barrel, add them to `packages/core/src/index.ts` (they live in `playbook/build-agent-run.ts`, already re-exported by the playbook barrel — verify). `FileVault`/`resolveAuditKey` are exported via `security/*`.

- [ ] **Step 3b: Export** — append to `packages/state/src/index.ts`: `export * from "./build-durable-agent-run.js";`

- [ ] **Step 4: Run → pass + 100% coverage** of `build-durable-agent-run.ts`:
      `npx vitest run packages/state/test/build-durable-agent-run.test.ts --coverage.enabled --coverage.include='packages/state/src/build-durable-agent-run.ts'` — PASS, 100% (the empty-db verify test + the full run cover both helpers; `closeDriver` covered by both). If a branch is uncovered, add a focused test.

- [ ] **Step 5: Gates + build.** prettier/eslint on the new files; `npm run build` clean.

- [ ] **Step 6: Commit.**

```bash
git add packages/state/src/build-durable-agent-run.ts packages/state/src/index.ts packages/state/test/build-durable-agent-run.test.ts
git commit -m "feat(state): buildDurableAgentRun + verifyDurable — durable+keyed composition root (A1b)"
```

---

### Task 2: The `openhawkins-run` durable CLI

**Files:**

- Create: `packages/state/src/bin/openhawkins-run.ts`

(`src/bin/**` is coverage-excluded; exercised by the Task 3 functional test.)

- [ ] **Step 1: Write `packages/state/src/bin/openhawkins-run.ts`:**

```ts
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedOperator, weakHostFactsModel, ValidateGate } from "@openhawkins/core";
import { buildDurableAgentRun, verifyDurable } from "../build-durable-agent-run.js";

/**
 * `openhawkins-run` — a durable, keyed-audit agent run over SQLite (A1b: F-C1/F-C2 at
 * runtime). The scripted model + a trivial Validate make a deterministic offline demo;
 * the SQLite event store, the Vault-resolved audit key, and the keyed HMAC chain are all
 * REAL. `--verify` reopens an existing db+vault (a SEPARATE process) and reports whether
 * the keyed chain still verifies — the cross-process durability proof.
 */
function flag(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dbPath = flag(args, "--db", join(tmpdir(), "openhawkins.db"));
  const vaultPath = flag(args, "--vault", join(tmpdir(), "openhawkins-vault.json"));
  const passphrase = flag(
    args,
    "--passphrase",
    process.env.OPENHAWKINS_VAULT_PASS ?? "openhawkins",
  );
  const asJson = args.includes("--json");

  if (args.includes("--verify")) {
    const v = await verifyDurable({ dbPath, vaultPath, passphrase });
    console.log(asJson ? JSON.stringify({ mode: "verify", ...v }) : `verify: ${JSON.stringify(v)}`);
    return;
  }

  const built = await buildDurableAgentRun({
    dbPath,
    vaultPath,
    passphrase,
    adapter: weakHostFactsModel(tmpdir()),
    grounding: "cited",
    prompts: { Execute: "How much disk space is free on this machine?" },
    operator: new ScriptedOperator(
      Array.from({ length: 8 }, () => ({ approve: true as const, actor: "cli", reason: "auto" })),
    ),
    validateGate: new ValidateGate(async () => ({ ok: true })),
  });
  const result = await built.run.run();
  const verified = await built.audit.verify();
  built.close();
  console.log(
    asJson
      ? JSON.stringify({ mode: "run", result, auditVerified: verified })
      : `run ${result.kind}; audit ${verified ? "verified" : "TAMPERED"}; db ${dbPath}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
```

- [ ] **Step 2: Build + smoke it.**
      `npm run build` then, in a temp dir:
      `node packages/state/dist/bin/openhawkins-run.js --db /tmp/oh-a1b.db --vault /tmp/oh-a1b-vault.json --json`
      → `{"mode":"run","result":{"kind":"completed"},"auditVerified":true}`.
      Then a SEPARATE process:
      `node packages/state/dist/bin/openhawkins-run.js --db /tmp/oh-a1b.db --vault /tmp/oh-a1b-vault.json --verify --json`
      → `{"mode":"verify","events":<n>,"auditEntries":<m>,"auditVerified":true}` with `auditEntries > 6`. Paste both.

- [ ] **Step 3: Gates.** prettier/eslint on the bin file.

- [ ] **Step 4: Commit.**

```bash
git add packages/state/src/bin/openhawkins-run.ts
git commit -m "feat(state): openhawkins-run durable CLI (run + --verify) (A1b)"
```

---

### Task 3: Black-box functional e2e (cross-process durability proof)

**Files:**

- Test: `packages/state/test-functional/durable-run.e2e.test.ts`

- [ ] **Step 1: Write the functional test** — `packages/state/test-functional/durable-run.e2e.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Black-box: spawn the actual built durable CLI, then RE-SPAWN a separate process to
// verify — proving events + the keyed audit chain survive across processes on disk.
const run = promisify(execFile);
const CLI = "packages/state/dist/bin/openhawkins-run.js";

describe("openhawkins-run — durable functional (black-box, cross-process)", () => {
  it("persists a keyed-audit run and a fresh process verifies it", async () => {
    const d = mkdtempSync(join(tmpdir(), "oh-a1b-fn-"));
    const db = join(d, "run.db");
    const vault = join(d, "vault.json");
    const common = ["--db", db, "--vault", vault, "--json"];

    const r1 = await run("node", [CLI, ...common]);
    const out1 = JSON.parse(r1.stdout.trim().split("\n").filter(Boolean).pop() ?? "");
    expect(out1.mode).toBe("run");
    expect(out1.result.kind).toBe("completed");
    expect(out1.auditVerified).toBe(true);

    // a SEPARATE process reopens the same db + vault and verifies the keyed chain
    const r2 = await run("node", [CLI, ...common, "--verify"]);
    const out2 = JSON.parse(r2.stdout.trim().split("\n").filter(Boolean).pop() ?? "");
    expect(out2.mode).toBe("verify");
    expect(out2.auditVerified).toBe(true); // the Vault key persisted; the chain verifies
    expect(out2.events).toBeGreaterThan(0);
    expect(out2.auditEntries).toBeGreaterThan(6);
  });
});
```

- [ ] **Step 2: Build, then run the functional suite.**
      `npm run build && npm run test:functional`
      Expect the new test PASSES alongside the existing functional tests. Paste the summary.

- [ ] **Step 3: Gates.** prettier/eslint on the test.

- [ ] **Step 4: Commit.**

```bash
git add packages/state/test-functional/durable-run.e2e.test.ts
git commit -m "test(state): black-box cross-process durable-run e2e (A1b — F-C1/F-C2 at runtime)"
```

---

### Task 4: Full gate + roadmap

- [ ] **Step 1: Roadmap.** In `docs/reviews/2026-06-09-production-readiness-review.md` §3, find/add the **A1b** follow-up item and mark it done: `**A1b — Runtime durable cutover ✅ DONE (PR pending).** A `packages/state` composition root (`buildDurableAgentRun`+ the`openhawkins-run`CLI with`--db`/`--vault`/`--verify`) wires the SQLite event store + the Vault-keyed audit into a runnable entrypoint, proven across processes by a black-box e2e — so F-C1 (durability) and F-C2 (keyed audit) are now closed AT RUNTIME, not just in the library.` Also tighten the A1 and A2 marks if they say "library only" to reference A1b as the cutover.

- [ ] **Step 2: Full repo gate.**
      `npm run build && npm run lint && npm run format:check && npm run coverage && npm run test:functional` — all green; aggregate ≥99%; `build-durable-agent-run.ts` 100% (`bin/**` excluded). Paste the coverage tail.

- [ ] **Step 3: Docker gate.** `docker build -f Dockerfile.test -t openhawkins-test . && docker run --rm openhawkins-test` → `✅ ALL GATES PASSED`.

- [ ] **Step 4: Commit.**

```bash
git add docs/reviews/2026-06-09-production-readiness-review.md
git commit -m "docs(review): A1b runtime durable cutover done — F-C1/F-C2 closed at runtime"
```

---

## Self-Review (coverage of the A1b scope)

- **F-C1/F-C2 at runtime:** `buildDurableAgentRun` wires `SqliteEventStore` + `SqliteAuditLog(db, resolveAuditKey(FileVault))` into a runnable CLI; the functional test proves persistence + keyed-audit verification ACROSS PROCESSES. ✓
- **No package cycle:** the durable wiring lives in `state` (which depends on `core`), not in `core`. ✓
- **Coverage:** `build-durable-agent-run.ts` 100% via unit tests; the CLI bin is coverage-excluded and exercised black-box. ✓
- **Type consistency:** `DurableAgentRunOpts`, `BuiltDurableAgentRun`, `buildDurableAgentRun`, `verifyDurable` — used identically across tasks; reuses `buildAgentRun`/`resolveAuditKey`/`FileVault`/`SqliteEventStore`/`SqliteAuditLog` unchanged. ✓

## Next (Track A continues)

With durability + keyed audit live at runtime, A3 (event-plane redaction, F-C3) hardens what lands in that durable store. Then A4–A8, plus A2b/A2c and Track B.
