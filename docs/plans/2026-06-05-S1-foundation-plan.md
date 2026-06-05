# S1 Foundation (S1.0 + S1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the OpenHawkins monorepo and the event-sourced, single-writer session core — a cross-platform, single-binary-capable foundation with a deterministic replay primitive — proven by tests on Windows, macOS, and Linux.

**Architecture:** An npm-workspaces TypeScript monorepo. The first package, `@openhawkins/core`, contains an OS-abstraction layer (no shelling out — uses `fs.statfs`) and an event-sourced session aggregate whose state is a pure fold over an append-only event log, mutated only through a single-writer serialized queue. Bun `--compile` is validated as the single-binary path; Node is the dev/test runtime. Everything non-deterministic (time) is injected so the fold and replay are deterministic.

**Tech Stack:** TypeScript (strict) · npm workspaces · Vitest · ESLint (typescript-eslint) · Prettier · Bun (compile spike + CI runtime) · Node ≥ 20 · GitHub Actions.

**Spec:** [`docs/specs/2026-06-05-S1-core-runtime-grounding-design.md`](../specs/2026-06-05-S1-core-runtime-grounding-design.md) (milestones S1.0, S1.1). Follow-on plans will cover S1.2–S1.7.

---

## File Structure (created by this plan)

```
package.json                         # root: workspaces, scripts, dev deps
tsconfig.base.json                   # shared strict compiler options
vitest.config.ts                     # root test config (all packages)
eslint.config.js                     # flat config, type-checked
.prettierrc.json                     # formatting rules
.github/workflows/ci.yml             # win/mac/linux × node+bun matrix
packages/core/
  package.json                       # @openhawkins/core
  tsconfig.json                      # extends base; references
  src/
    index.ts                         # public barrel
    os/platform.ts                   # detectPlatform, freeDiskBytes, configDir, dataDir
    util/clock.ts                    # Clock type + systemClock (injected for determinism)
    util/ids.ts                      # createIdFactory (deterministic, injectable)
    session/events.ts                # DomainEvent union, EventStore, InMemoryEventStore
    session/state.ts                 # SessionState + reduceEvent (pure fold)
    session/session.ts               # Session aggregate: single-writer queue
    session/replay.ts                # rebuildState + assertDeterministic
    bin/probe.ts                     # tiny CLI for the Bun compile spike
  test/
    os/platform.test.ts
    util/clock.test.ts
    util/ids.test.ts
    session/events.test.ts
    session/state.test.ts
    session/session.test.ts
    session/replay.test.ts
```

**Responsibility boundaries:** `os/` knows the host; `util/` holds injected non-determinism (clock, ids); `session/events` defines the log; `session/state` is the pure fold; `session/session` is the only writer; `session/replay` reconstructs and proves determinism. Each file has one job and is independently testable.

---

# Milestone S1.0 — Foundation (scaffold + OS layer + Bun spike + CI)

### Task 1: Root monorepo scaffold

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.prettierrc.json`
- Create: `eslint.config.js`

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "openhawkins",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "lint": "eslint .",
    "format": "prettier --write \"**/*.{ts,json,md,yml}\"",
    "format:check": "prettier --check \"**/*.{ts,json,md,yml}\""
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^9.9.0",
    "globals": "^15.9.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "composite": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/bin/**"],
    },
  },
});
```

- [ ] **Step 4: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 5: Create `eslint.config.js`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true },
    },
  },
);
```

- [ ] **Step 6: Install and verify the toolchain resolves**

Run: `npm install`
Expected: completes; creates `package-lock.json`; no peer-dep errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts .prettierrc.json eslint.config.js
git commit -m "chore(s1.0): root monorepo scaffold (workspaces, ts, vitest, eslint, prettier)"
```

---

### Task 2: `@openhawkins/core` package scaffold

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@openhawkins/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": { "build": "tsc -b" },
  "dependencies": {}
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create the barrel `packages/core/src/index.ts`**

```ts
export * from "./os/platform.js";
export * from "./util/clock.js";
export * from "./util/ids.js";
export * from "./session/events.js";
export * from "./session/state.js";
export * from "./session/session.js";
export * from "./session/replay.js";
```

- [ ] **Step 4: Add the package to the root TS build graph**

Edit `tsconfig.base.json`? No — create a root `tsconfig.json` with references.
Create `tsconfig.json` at repo root:

```json
{
  "files": [],
  "references": [{ "path": "packages/core" }]
}
```

- [ ] **Step 5: Verify the build graph resolves (will be empty but valid)**

Run: `npm run build`
Expected: fails because the barrel imports files that don't exist yet — that's OK; the next tasks create them. To verify scaffolding only, temporarily confirm `npx tsc -b --dry` lists `packages/core`. Expected: lists the project.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/src/index.ts tsconfig.json
git commit -m "chore(s1.0): scaffold @openhawkins/core package + TS project references"
```

---

### Task 3: `Clock` injection (deterministic time)

**Files:**

- Create: `packages/core/src/util/clock.ts`
- Test: `packages/core/test/util/clock.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { systemClock, fixedClock } from "../../src/util/clock.js";

describe("clock", () => {
  it("systemClock returns a number close to Date.now()", () => {
    const before = Date.now();
    const t = systemClock();
    expect(t).toBeGreaterThanOrEqual(before);
  });

  it("fixedClock returns a constant, then can be advanced", () => {
    const clock = fixedClock(1000);
    expect(clock()).toBe(1000);
    clock.advance(5);
    expect(clock()).toBe(1005);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/util/clock.test.ts`
Expected: FAIL — cannot find module `clock.js`.

- [ ] **Step 3: Write the implementation**

```ts
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

export interface FixedClock extends Clock {
  advance(ms: number): void;
}

export function fixedClock(start: number): FixedClock {
  let now = start;
  const clock = (() => now) as FixedClock;
  clock.advance = (ms: number) => {
    now += ms;
  };
  return clock;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/util/clock.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/clock.ts packages/core/test/util/clock.test.ts
git commit -m "feat(core): injectable Clock for deterministic time"
```

---

### Task 4: Deterministic id factory

**Files:**

- Create: `packages/core/src/util/ids.ts`
- Test: `packages/core/test/util/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createIdFactory } from "../../src/util/ids.js";

describe("createIdFactory", () => {
  it("produces prefixed, monotonically increasing ids", () => {
    const id = createIdFactory("turn");
    expect(id()).toBe("turn-1");
    expect(id()).toBe("turn-2");
  });

  it("separate factories have independent counters", () => {
    const a = createIdFactory("s");
    const b = createIdFactory("s");
    expect(a()).toBe("s-1");
    expect(b()).toBe("s-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/util/ids.test.ts`
Expected: FAIL — cannot find module `ids.js`.

- [ ] **Step 3: Write the implementation**

```ts
export type IdFactory = () => string;

export function createIdFactory(prefix: string): IdFactory {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/util/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/ids.ts packages/core/test/util/ids.test.ts
git commit -m "feat(core): deterministic id factory"
```

---

### Task 5: OS abstraction — `detectPlatform`

**Files:**

- Create: `packages/core/src/os/platform.ts`
- Test: `packages/core/test/os/platform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { detectPlatform } from "../../src/os/platform.js";

describe("detectPlatform", () => {
  it("maps the current process.platform to a known os", () => {
    const p = detectPlatform();
    expect(["windows", "macos", "linux"]).toContain(p.os);
    expect(p.shell).toBeTruthy();
  });

  it("maps win32/darwin/linux deterministically when passed explicitly", () => {
    expect(detectPlatform("win32").os).toBe("windows");
    expect(detectPlatform("win32").shell).toBe("powershell");
    expect(detectPlatform("darwin").os).toBe("macos");
    expect(detectPlatform("linux").os).toBe("linux");
    expect(detectPlatform("linux").shell).toBe("bash");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: FAIL — cannot find module `platform.js`.

- [ ] **Step 3: Write the implementation (detectPlatform only)**

```ts
export type OsName = "windows" | "macos" | "linux";
export type ShellName = "powershell" | "bash";

export interface PlatformInfo {
  os: OsName;
  shell: ShellName;
}

export function detectPlatform(platform: NodeJS.Platform = process.platform): PlatformInfo {
  switch (platform) {
    case "win32":
      return { os: "windows", shell: "powershell" };
    case "darwin":
      return { os: "macos", shell: "bash" };
    default:
      return { os: "linux", shell: "bash" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/os/platform.ts packages/core/test/os/platform.test.ts
git commit -m "feat(core): detectPlatform OS/shell abstraction"
```

---

### Task 6: OS abstraction — `freeDiskBytes` (cross-platform, no shell)

**Files:**

- Modify: `packages/core/src/os/platform.ts`
- Test: `packages/core/test/os/platform.test.ts`

- [ ] **Step 1: Add the failing test (append to the existing test file)**

```ts
import { freeDiskBytes } from "../../src/os/platform.js";
import { tmpdir } from "node:os";

describe("freeDiskBytes", () => {
  it("returns a positive integer number of bytes for the temp dir", async () => {
    const bytes = await freeDiskBytes(tmpdir());
    expect(Number.isInteger(bytes)).toBe(true);
    expect(bytes).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: FAIL — `freeDiskBytes` is not exported.

- [ ] **Step 3: Implement `freeDiskBytes` using `fs.statfs` (append to `platform.ts`)**

```ts
import { statfs } from "node:fs/promises";

// statfs is cross-platform on Node >= 19 (incl. Windows). bavail = blocks
// available to an unprivileged user; bsize = fundamental block size.
export async function freeDiskBytes(path: string): Promise<number> {
  const s = await statfs(path);
  return Math.floor(Number(s.bavail) * Number(s.bsize));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: PASS (3 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/os/platform.ts packages/core/test/os/platform.test.ts
git commit -m "feat(core): cross-platform freeDiskBytes via fs.statfs"
```

---

### Task 7: OS abstraction — `configDir` / `dataDir`

**Files:**

- Modify: `packages/core/src/os/platform.ts`
- Test: `packages/core/test/os/platform.test.ts`

- [ ] **Step 1: Add the failing test (append)**

```ts
import { configDir, dataDir } from "../../src/os/platform.js";

describe("configDir/dataDir", () => {
  const env = { HOME: "/home/x", APPDATA: "C:\\Users\\x\\AppData\\Roaming" };

  it("uses APPDATA on windows", () => {
    expect(configDir("windows", env)).toBe("C:\\Users\\x\\AppData\\Roaming\\openhawkins");
  });

  it("uses Application Support on macos", () => {
    expect(configDir("macos", env)).toBe("/home/x/Library/Application Support/openhawkins");
  });

  it("uses XDG-style path on linux", () => {
    expect(configDir("linux", env)).toBe("/home/x/.config/openhawkins");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: FAIL — `configDir`/`dataDir` not exported.

- [ ] **Step 3: Implement (append to `platform.ts`)**

```ts
import { join } from "node:path";

type Env = Record<string, string | undefined>;
const APP = "openhawkins";

export function configDir(os: OsName = detectPlatform().os, env: Env = process.env): string {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  switch (os) {
    case "windows":
      return join(env.APPDATA ?? join(home, "AppData", "Roaming"), APP);
    case "macos":
      return join(home, "Library", "Application Support", APP);
    default:
      return join(env.XDG_CONFIG_HOME ?? join(home, ".config"), APP);
  }
}

export function dataDir(os: OsName = detectPlatform().os, env: Env = process.env): string {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  switch (os) {
    case "windows":
      return join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), APP);
    case "macos":
      return join(home, "Library", "Application Support", APP);
    default:
      return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), APP);
  }
}
```

Note: `join` normalizes separators per the running OS; the windows assertion above
assumes the suite runs on a posix CI runner for the explicit-arg cases. To keep the
assertion OS-independent, compare with `join(...)` in the test instead of a literal.
Update the windows test assertion to:

```ts
import { join } from "node:path";
expect(configDir("windows", env)).toBe(join(env.APPDATA!, "openhawkins"));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/os/platform.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/os/platform.ts packages/core/test/os/platform.test.ts
git commit -m "feat(core): OS-appropriate configDir/dataDir resolution"
```

---

### Task 8: Probe CLI + Bun `--compile` spike

**Files:**

- Create: `packages/core/src/bin/probe.ts`

- [ ] **Step 1: Write the probe CLI**

```ts
import { detectPlatform, freeDiskBytes, configDir } from "../os/platform.js";
import { tmpdir } from "node:os";

async function main(): Promise<void> {
  const p = detectPlatform();
  const free = await freeDiskBytes(tmpdir());
  console.log(
    JSON.stringify({ os: p.os, shell: p.shell, configDir: configDir(), freeDiskBytes: free }),
  );
}

await main();
```

- [ ] **Step 2: Verify it runs under Node**

Run: `npx tsx packages/core/src/bin/probe.ts`
(If `tsx` is unavailable, run `node --experimental-strip-types packages/core/src/bin/probe.ts`.)
Expected: prints a JSON line with `os`, `shell`, `configDir`, and a positive `freeDiskBytes`.

- [ ] **Step 3: Compile a single binary with Bun (the spike)**

Run: `bun build packages/core/src/bin/probe.ts --compile --outfile dist/probe`
Expected: produces `dist/probe` (or `dist/probe.exe` on Windows).

- [ ] **Step 4: Run the compiled binary**

Run (posix): `./dist/probe` · Run (windows): `dist\probe.exe`
Expected: same JSON line as Step 2 — proving the single-binary path works end-to-end.

- [ ] **Step 5: Record the spike result as an ADR**

Create `docs/adr/0001-binary-toolchain.md`:

```markdown
# ADR 0001 — Binary toolchain: Bun --compile

**Status:** Accepted (S1.0 spike)
**Decision:** Use `bun build --compile` to produce single-file binaries per OS.
**Evidence:** `dist/probe` built and ran on <os/arch>, emitting platform + free
disk JSON identical to the Node run. `fs.statfs` works inside the Bun binary.
**Fallback:** Node SEA, if a native-dep blocker appears in a later milestone.
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/bin/probe.ts docs/adr/0001-binary-toolchain.md
git commit -m "feat(core): probe CLI + Bun --compile single-binary spike (ADR 0001)"
```

---

### Task 9: CI matrix (win/mac/linux × node + bun)

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  node:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm run format:check
      - run: npm test

  bun:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx vitest run
      - run: bun build packages/core/src/bin/probe.ts --compile --outfile probe-bin
```

- [ ] **Step 2: Verify the workflow is valid locally**

Run: `npm run build && npm run lint && npm run format:check && npm test`
Expected: all four succeed locally (this is what the `node` job runs).

- [ ] **Step 3: Commit and push to trigger CI**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(s1.0): win/mac/linux matrix across node + bun"
git push origin main
```

- [ ] **Step 4: Confirm CI is green**

Run: `gh run watch` (or check the Actions tab).
Expected: both `node` and `bun` jobs pass on all three OSes.

---

# Milestone S1.1 — Event-sourced session core

> Scope note: S1.1 delivers the event log, the pure state fold, the single-writer
> session aggregate, and **state-rebuild replay** (reconstruct session state from a
> recorded event log, deterministically). Feeding recorded _model/tool outputs_
> back through the agent loop is part of the agent-loop milestone (S1.4/S1.5),
> which builds on this primitive.

### Task 10: Domain events + event store

**Files:**

- Create: `packages/core/src/session/events.ts`
- Test: `packages/core/test/session/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { InMemoryEventStore, type DomainEvent } from "../../src/session/events.js";

const ev = (seq: number): DomainEvent => ({
  type: "SessionStarted",
  sessionId: "s-1",
  agentId: "probe-agent",
  at: seq,
});

describe("InMemoryEventStore", () => {
  it("appends and reads back events in order, scoped by session", async () => {
    const store = new InMemoryEventStore();
    await store.append(ev(1));
    await store.append({
      type: "TurnStarted",
      sessionId: "s-1",
      turnId: "t-1",
      input: "hi",
      at: 2,
    });
    const events = await store.read("s-1");
    expect(events.map((e) => e.type)).toEqual(["SessionStarted", "TurnStarted"]);
  });

  it("isolates events by sessionId", async () => {
    const store = new InMemoryEventStore();
    await store.append(ev(1));
    expect(await store.read("other")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/session/events.test.ts`
Expected: FAIL — cannot find module `events.js`.

- [ ] **Step 3: Write the implementation**

```ts
export type DomainEvent =
  | { type: "SessionStarted"; sessionId: string; agentId: string; at: number }
  | { type: "TurnStarted"; sessionId: string; turnId: string; input: string; at: number }
  | { type: "TurnEnded"; sessionId: string; turnId: string; final: string; at: number };

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  read(sessionId: string): Promise<DomainEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly log: DomainEvent[] = [];

  async append(event: DomainEvent): Promise<void> {
    this.log.push(event);
  }

  async read(sessionId: string): Promise<DomainEvent[]> {
    return this.log.filter((e) => e.sessionId === sessionId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/session/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/events.ts packages/core/test/session/events.test.ts
git commit -m "feat(core): DomainEvent union + EventStore (in-memory)"
```

---

### Task 11: Pure state fold (`reduceEvent`)

**Files:**

- Create: `packages/core/src/session/state.ts`
- Test: `packages/core/test/session/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { initialState, reduceEvent, foldEvents } from "../../src/session/state.js";
import type { DomainEvent } from "../../src/session/events.js";

const events: DomainEvent[] = [
  { type: "SessionStarted", sessionId: "s-1", agentId: "probe-agent", at: 1 },
  { type: "TurnStarted", sessionId: "s-1", turnId: "t-1", input: "hi", at: 2 },
  { type: "TurnEnded", sessionId: "s-1", turnId: "t-1", final: "hello", at: 3 },
];

describe("session state fold", () => {
  it("reduceEvent is pure (does not mutate its input)", () => {
    const s0 = initialState();
    const s1 = reduceEvent(s0, events[0]);
    expect(s0.agentId).toBeUndefined();
    expect(s1.agentId).toBe("probe-agent");
  });

  it("foldEvents rebuilds the full session state", () => {
    const s = foldEvents(events);
    expect(s.agentId).toBe("probe-agent");
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0]).toEqual({ id: "t-1", input: "hi", final: "hello" });
  });

  it("is deterministic — same events produce equal state", () => {
    expect(foldEvents(events)).toEqual(foldEvents(events));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/session/state.test.ts`
Expected: FAIL — cannot find module `state.js`.

- [ ] **Step 3: Write the implementation**

```ts
import type { DomainEvent } from "./events.js";

export interface TurnState {
  id: string;
  input: string;
  final?: string;
}

export interface SessionState {
  agentId?: string;
  turns: TurnState[];
}

export function initialState(): SessionState {
  return { turns: [] };
}

export function reduceEvent(state: SessionState, event: DomainEvent): SessionState {
  switch (event.type) {
    case "SessionStarted":
      return { ...state, agentId: event.agentId };
    case "TurnStarted":
      return { ...state, turns: [...state.turns, { id: event.turnId, input: event.input }] };
    case "TurnEnded":
      return {
        ...state,
        turns: state.turns.map((t) => (t.id === event.turnId ? { ...t, final: event.final } : t)),
      };
  }
}

export function foldEvents(events: readonly DomainEvent[]): SessionState {
  return events.reduce(reduceEvent, initialState());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/session/state.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/state.ts packages/core/test/session/state.test.ts
git commit -m "feat(core): pure session state fold (reduceEvent/foldEvents)"
```

---

### Task 12: Single-writer `Session` aggregate

**Files:**

- Create: `packages/core/src/session/session.ts`
- Test: `packages/core/test/session/session.test.ts`

- [ ] **Step 1: Write the failing test (incl. the serialization property)**

```ts
import { describe, it, expect } from "vitest";
import { Session } from "../../src/session/session.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { fixedClock } from "../../src/util/clock.js";

describe("Session (single-writer)", () => {
  it("records a turn as TurnStarted + TurnEnded and exposes folded state", async () => {
    const store = new InMemoryEventStore();
    const clock = fixedClock(100);
    const session = await Session.start({ sessionId: "s-1", agentId: "probe-agent", store, clock });

    await session.runTurn("ping", async () => "pong");

    expect(session.state.turns).toEqual([{ id: "s-1-turn-1", input: "ping", final: "pong" }]);
    const types = (await store.read("s-1")).map((e) => e.type);
    expect(types).toEqual(["SessionStarted", "TurnStarted", "TurnEnded"]);
  });

  it("serializes concurrent turns — no interleaving (single writer)", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-2",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });

    const order: string[] = [];
    const slow = session.runTurn("a", async () => {
      order.push("a:start");
      await new Promise((r) => setTimeout(r, 20));
      order.push("a:end");
      return "A";
    });
    const fast = session.runTurn("b", async () => {
      order.push("b:start");
      return "B";
    });

    await Promise.all([slow, fast]);
    // b must not start until a has fully ended (serialized writer)
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
    expect(session.state.turns.map((t) => t.final)).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/session/session.test.ts`
Expected: FAIL — cannot find module `session.js`.

- [ ] **Step 3: Write the implementation**

```ts
import { type EventStore, type DomainEvent } from "./events.js";
import { type SessionState, reduceEvent, initialState } from "./state.js";
import { type Clock, systemClock } from "../util/clock.js";
import { createIdFactory, type IdFactory } from "../util/ids.js";

export interface SessionDeps {
  sessionId: string;
  agentId: string;
  store: EventStore;
  clock?: Clock;
}

export class Session {
  private _state: SessionState = initialState();
  private tail: Promise<unknown> = Promise.resolve();
  private readonly nextTurnId: IdFactory;

  private constructor(
    private readonly sessionId: string,
    private readonly store: EventStore,
    private readonly clock: Clock,
  ) {
    this.nextTurnId = createIdFactory(`${sessionId}-turn`);
  }

  static async start(deps: SessionDeps): Promise<Session> {
    const session = new Session(deps.sessionId, deps.store, deps.clock ?? systemClock);
    await session.commit({
      type: "SessionStarted",
      sessionId: deps.sessionId,
      agentId: deps.agentId,
      at: session.clock(),
    });
    return session;
  }

  get state(): SessionState {
    return this._state;
  }

  /** Serialized: each call runs only after the previous one fully settles. */
  runTurn(input: string, handler: () => Promise<string>): Promise<void> {
    const run = this.tail.then(() => this.doRunTurn(input, handler));
    // keep the chain alive even if a turn rejects
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async doRunTurn(input: string, handler: () => Promise<string>): Promise<void> {
    const turnId = this.nextTurnId();
    await this.commit({
      type: "TurnStarted",
      sessionId: this.sessionId,
      turnId,
      input,
      at: this.clock(),
    });
    const final = await handler();
    await this.commit({
      type: "TurnEnded",
      sessionId: this.sessionId,
      turnId,
      final,
      at: this.clock(),
    });
  }

  private async commit(event: DomainEvent): Promise<void> {
    await this.store.append(event);
    this._state = reduceEvent(this._state, event);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/session/session.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/test/session/session.test.ts
git commit -m "feat(core): single-writer Session aggregate (serialized turns)"
```

---

### Task 13: State-rebuild replay + determinism assertion

**Files:**

- Create: `packages/core/src/session/replay.ts`
- Test: `packages/core/test/session/replay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Session } from "../../src/session/session.js";
import { InMemoryEventStore } from "../../src/session/events.js";
import { fixedClock } from "../../src/util/clock.js";
import { rebuildState, assertDeterministic } from "../../src/session/replay.js";

describe("replay", () => {
  it("rebuildState reconstructs the live session state from the event log", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-1",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ping", async () => "pong");

    const replayed = await rebuildState(store, "s-1");
    expect(replayed).toEqual(session.state);
  });

  it("assertDeterministic passes for a recorded log (same events -> same state)", async () => {
    const store = new InMemoryEventStore();
    const session = await Session.start({
      sessionId: "s-1",
      agentId: "probe-agent",
      store,
      clock: fixedClock(0),
    });
    await session.runTurn("ping", async () => "pong");

    await expect(assertDeterministic(store, "s-1")).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/session/replay.test.ts`
Expected: FAIL — cannot find module `replay.js`.

- [ ] **Step 3: Write the implementation**

```ts
import type { EventStore } from "./events.js";
import { foldEvents, type SessionState } from "./state.js";

/** Rebuild session state purely from the recorded event log. */
export async function rebuildState(store: EventStore, sessionId: string): Promise<SessionState> {
  const events = await store.read(sessionId);
  return foldEvents(events);
}

/**
 * Determinism guarantee: folding the same recorded log twice yields deeply equal
 * state. This is the primitive the agent loop's output-replay (S1.4/S1.5) builds on.
 */
export async function assertDeterministic(store: EventStore, sessionId: string): Promise<boolean> {
  const a = await rebuildState(store, sessionId);
  const b = await rebuildState(store, sessionId);
  return JSON.stringify(a) === JSON.stringify(b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/test/session/replay.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Full build + suite + lint green, then commit**

Run: `npm run build && npm test && npm run lint && npm run format:check`
Expected: build succeeds (the barrel now resolves every module), all tests pass, lint/format clean.

```bash
git add packages/core/src/session/replay.ts packages/core/test/session/replay.test.ts
git commit -m "feat(core): state-rebuild replay + determinism assertion"
```

- [ ] **Step 6: Push and confirm CI green on 3 OSes**

```bash
git push origin main
gh run watch
```

Expected: `node` and `bun` jobs green on ubuntu/macos/windows.

---

## Self-review notes (coverage of S1.0 + S1.1)

- **S1.0 scaffold/CI/Bun spike/OS layer:** Tasks 1–9. ✓
- **S1.1 event log / fold / single-writer / replay:** Tasks 10–13. ✓
- **Determinism (spec §7.2):** Clock + id factory injected (Tasks 3–4); fold is pure (Task 11); replay determinism asserted (Task 13). ✓
- **Session integrity (spec §8.4):** single-writer serialization property test (Task 12). ✓
- **Cross-platform (spec §9):** `fs.statfs`, OS-path resolution, and the win/mac/linux CI matrix (Tasks 6, 7, 9). ✓
- **Type consistency:** `DomainEvent`, `SessionState`/`TurnState`, `Clock`, `IdFactory`, `EventStore` names are used identically across Tasks 10–13. ✓
- **Not yet covered (by design — later S1 plans):** EventStore→SQLite (S2), model adapters + agent loop (S1.3/S1.4), Eleven grounding (S1.5/S1.6), Murray/Cabin/Lab/Gate (S1.6), the `disk_free` tool + the hallucination eval (S1.2 + S1.7).

---

## Next plans (to be written after this one lands)

- **S1.2** — tool registry (Zod→native schema) + capability checks + `disk_free`.
- **S1.3** — model-adapter interface + Ollama (local+cloud) + OpenAI-compat + FileVault.
- **S1.4** — agent loop + native tool-calling round-trip.
- **S1.5/S1.6** — Eleven grounding + Murray/Gate/Lab.
- **S1.7** — eval harness + the hallucination test + negative control; green on 3 OSes.
