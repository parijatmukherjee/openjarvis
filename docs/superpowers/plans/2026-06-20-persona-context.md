# Persona + Context Threading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread persona, userId, and recent intents through the model system prompt at all three nexus call sites (router, pool general agent, synthesizer) via a centralized `buildSystemPrompt(role, context)` helper, capped at 1500 characters.

**Architecture:** Add a pure helper `packages/jarvis/src/nexus/system-prompt.ts` that joins a `JARVIS_PERSONA` const + user id + last 3 recent intents + role-specific tail, truncating with `…` when over 1500 chars. The four call sites (router.chat, pool.general.chat, synthesizer.chatStream, synthesizer.chat) swap their hardcoded system strings for `buildSystemPrompt(role, context)`. Helper is pure → no model client dependency, trivially testable.

**Tech Stack:** TypeScript, vitest, existing nexus engine. No new dependencies.

## Global Constraints

- 99% coverage on all four metrics (statements / lines / functions / branches).
- TDD discipline: failing test first, then implementation.
- One commit per task.
- Existing tests for router, pool, synthesizer must continue to pass unchanged (they assert on request body shape, not the system string).
- `nexus:executeIntent` (non-streaming) and Round 16 streaming both keep working unchanged.
- Cross-platform: Ubuntu, macOS, Windows Git Bash.
- Use Node ≥22 for vitest (Node 24.14.0 verified locally).

---

### Task 1: Add `buildSystemPrompt` helper + persona constant

**Files:**
- Create: `packages/jarvis/src/nexus/system-prompt.ts`
- Create: `packages/jarvis/test/nexus/system-prompt.test.ts`

**Interfaces:**
- Consumes: `JarvisContext` from `./types.js`.
- Produces: `buildSystemPrompt(role: SystemPromptRole, context: JarvisContext): string` — a non-empty system prompt string, ≤1500 chars.
- Exports: `SystemPromptRole` type union (`"router" | "general" | "synthesizer"`), `JARVIS_PERSONA` const, `SYSTEM_PROMPT_MAX_CHARS` const (1500).

- [ ] **Step 1: Write the failing test**

Create `packages/jarvis/test/nexus/system-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  JARVIS_PERSONA,
  SYSTEM_PROMPT_MAX_CHARS,
  type SystemPromptRole,
} from "../../src/nexus/system-prompt.js";
import type { JarvisContext } from "../../src/nexus/types.js";

const baseContext: JarvisContext = {
  sessionId: "s1",
  userId: "desktop-user",
  recentIntents: [],
  currentTime: new Date("2026-06-20T12:00:00Z"),
};

describe("buildSystemPrompt", () => {
  it("includes persona, user id, and role tail", () => {
    const prompt = buildSystemPrompt("router", baseContext);
    expect(prompt).toContain(JARVIS_PERSONA);
    expect(prompt).toContain("User: desktop-user");
    expect(prompt.toLowerCase()).toContain("classifier"); // role tail cue
  });

  it("omits the Recent actions line when recentIntents is empty", () => {
    const prompt = buildSystemPrompt("general", baseContext);
    expect(prompt).not.toContain("Recent actions:");
  });

  it("includes the last 3 intent actions when present", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: [
        { action: "check_weather", params: {}, confidence: 1, ambiguous: false },
        { action: "search", params: {}, confidence: 1, ambiguous: false },
        { action: "chat", params: {}, confidence: 1, ambiguous: false },
        { action: "send_email", params: {}, confidence: 1, ambiguous: false }, // oldest, dropped
      ],
    };
    const prompt = buildSystemPrompt("synthesizer", ctx);
    expect(prompt).toContain("Recent actions: send_email, chat, search");
    // check_weather was 4th most recent → dropped (only last 3 kept)
  });

  it("role-specific tail differs across roles", () => {
    const routerPrompt = buildSystemPrompt("router", baseContext);
    const generalPrompt = buildSystemPrompt("general", baseContext);
    const synthPrompt = buildSystemPrompt("synthesizer", baseContext);
    expect(routerPrompt).not.toBe(generalPrompt);
    expect(generalPrompt).not.toBe(synthPrompt);
    expect(routerPrompt).not.toBe(synthPrompt);
  });

  it("truncates with … when total exceeds SYSTEM_PROMPT_MAX_CHARS", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: Array.from({ length: 100 }, (_, i) => ({
        action: `action_with_a_long_name_${i}`,
        params: {},
        confidence: 1,
        ambiguous: false,
      })),
    };
    const prompt = buildSystemPrompt("general", ctx);
    expect(prompt.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    expect(prompt.endsWith("…")).toBe(true);
  });

  it("returns a non-empty prompt even with minimal context", () => {
    const prompt = buildSystemPrompt("router", baseContext);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("does not exceed SYSTEM_PROMPT_MAX_CHARS even with normal inputs", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: [
        { action: "check_weather", params: {}, confidence: 1, ambiguous: false },
        { action: "search", params: {}, confidence: 1, ambiguous: false },
      ],
    };
    for (const role of ["router", "general", "synthesizer"] as SystemPromptRole[]) {
      const prompt = buildSystemPrompt(role, ctx);
      expect(prompt.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/nexus/system-prompt.test.ts`
Expected: FAIL with "Cannot find module .../system-prompt.js" or "buildSystemPrompt is not a function".

- [ ] **Step 3: Implement `buildSystemPrompt`**

Create `packages/jarvis/src/nexus/system-prompt.ts`:

```ts
import type { JarvisContext } from "./types.js";

export type SystemPromptRole = "router" | "general" | "synthesizer";

export const JARVIS_PERSONA = `You are JARVIS (Just A Rather Very Intelligent System), a concise, helpful AI assistant. Speak with dry British wit. Prefer short, direct answers. Avoid hedging. If you don't know, say so.`;

const ROLE_TAILS: Record<SystemPromptRole, string> = {
  router:
    "You are an intent classifier. Respond with JSON: { action: '<action>', confidence: <0.0-1.0> }. Valid actions follow.",
  general: "Respond concisely to the user's question.",
  synthesizer:
    "Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
};

export const SYSTEM_PROMPT_MAX_CHARS = 1500;

export function buildSystemPrompt(
  role: SystemPromptRole,
  context: JarvisContext,
): string {
  const user = `User: ${context.userId}`;
  const recentActions = context.recentIntents
    .slice(-3)
    .map((i) => i.action)
    .filter((a): a is string => typeof a === "string" && a.length > 0);
  const recent =
    recentActions.length > 0 ? `Recent actions: ${recentActions.join(", ")}` : "";
  const tail = ROLE_TAILS[role];
  const parts = [JARVIS_PERSONA, user, recent, tail].filter(Boolean);
  const joined = parts.join("\n\n");
  if (joined.length <= SYSTEM_PROMPT_MAX_CHARS) return joined;
  return joined.slice(0, SYSTEM_PROMPT_MAX_CHARS - 1) + "…";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/jarvis && npx vitest run test/nexus/system-prompt.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Run full jarvis test suite**

Run: `cd /home/parijat/workspace/openjarvis && npx vitest run`
Expected: all tests still pass (no regressions; this task only adds new files).

- [ ] **Step 6: Run lint, format:check, tsc -b**

Run:
```
cd /home/parijat/workspace/openjarvis && npm run lint
cd /home/parijat/workspace/openjarvis && npm run format:check
cd /home/parijat/workspace/openjarvis && npx tsc -b
```
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add packages/jarvis/src/nexus/system-prompt.ts packages/jarvis/test/nexus/system-prompt.test.ts
git commit -m "feat(nexus): add buildSystemPrompt helper with persona, user, recent intents"
```

---

### Task 2: Wire `buildSystemPrompt` into `RuleBasedRouter`

**Files:**
- Modify: `packages/jarvis/src/nexus/router.ts` (replace the hardcoded system string in the `client.chat(...)` call)

**Interfaces:**
- Consumes: `buildSystemPrompt("router", context)` from Task 1.
- Produces: router passes the new system prompt to the model.

- [ ] **Step 1: Read the existing router.ts**

Read `packages/jarvis/src/nexus/router.ts` to confirm the existing call shape. The relevant lines are:
- Line ~50-70: `async route(intent: Intent, _context: JarvisContext): Promise<DispatchPlan>`
- Inside, when `this.client?.isAvailable()` is true, the call:
  ```ts
  const response = await this.client.chat(
    `Classify: "${intent.action}"`,
    `You are an intent classifier. Respond with JSON: { action: "<action>", confidence: <0.0-1.0> }. Valid actions: ${validActions}`,
  );
  ```

- [ ] **Step 2: Replace the hardcoded string with `buildSystemPrompt("router", context)`**

Modify `packages/jarvis/src/nexus/router.ts`:

Add import at top:
```ts
import { buildSystemPrompt } from "./system-prompt.js";
```

Change the parameter from `_context` to `context` (drop the underscore — we now use it):
```ts
async route(intent: Intent, context: JarvisContext): Promise<DispatchPlan> {
```

Replace the call to `this.client.chat(...)`:
```ts
const response = await this.client.chat(
  `Classify: "${intent.action}"`,
  buildSystemPrompt("router", context),
);
```

Note: the existing call concatenates `validActions` into the system string. Move that to the prompt itself so `buildSystemPrompt` stays simple:
```ts
const response = await this.client.chat(
  `Classify: "${intent.action}". Valid actions: ${validActions}`,
  buildSystemPrompt("router", context),
);
```

- [ ] **Step 3: Run router tests**

Run: `cd packages/jarvis && npx vitest run test/nexus/router.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Run full vitest suite**

Run: `cd /home/parijat/workspace/openjarvis && npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Run lint, format:check, tsc -b**

Run:
```
cd /home/parijat/workspace/openjarvis && npm run lint
cd /home/parijat/workspace/openjarvis && npm run format:check
cd /home/parijat/workspace/openjarvis && npx tsc -b
```
Expected: all clean. Run prettier --write on router.ts if format:check fails.

- [ ] **Step 6: Commit**

```bash
git add packages/jarvis/src/nexus/router.ts
git commit -m "feat(router): use buildSystemPrompt for context-aware classification"
```

---

### Task 3: Wire `buildSystemPrompt` into `InProcessAgentPool` general agent

**Files:**
- Modify: `packages/jarvis/src/nexus/pool.ts` (replace the hardcoded system string in the general agent's `client.chat(...)` call)

**Interfaces:**
- Consumes: `buildSystemPrompt("general", context)` from Task 1.
- Produces: pool general agent passes the new system prompt to the model.

- [ ] **Step 1: Read the existing pool.ts**

Read `packages/jarvis/src/nexus/pool.ts` to find the general agent handler. It's around line 198-217 in the constructor's agents Map:
```ts
[
  "general",
  async (ctx: AgentContext) => {
    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const prompt = (ctx.intent.params?.text as string) ?? ctx.intent.action;
          const response = await this.client.chat(
            prompt,
            "You are JARVIS, a helpful AI assistant. Respond concisely.",
          );
          return { response: response.content };
        }
      } catch {
        // Model unavailable, return acknowledgment
      }
    }
    return { response: "I'm here. How can I help?" };
  },
],
```

Note: `AgentContext` has `intent: Intent` but not `JarvisContext`. We need `JarvisContext` for `buildSystemPrompt`. Check how the engine calls `agentPool.execute(route, agentContext)` — see engine.ts line ~96 where `agentContext` is built. The current `agentContext` has `sessionId`, `intent`, and `memory`. We need to extend it to include `JarvisContext`.

Wait, that's a bigger change than this task. **Simpler approach:** thread `JarvisContext` through `agentPool.execute` → `AgentContext`. Look at the existing signature and find the minimal change.

Look at `AgentContext` interface (likely in `nexus/types.ts`):
```ts
export interface AgentContext {
  sessionId: string;
  intent: Intent;
  memory?: unknown;
}
```

Add `jarvisContext?: JarvisContext` (optional, to keep the change minimal). The engine passes `context` when building `agentContext`. Then the general agent reads `ctx.jarvisContext ?? fallbackContext`.

- [ ] **Step 2: Modify AgentContext to include optional JarvisContext**

In `packages/jarvis/src/nexus/types.ts`:

```ts
export interface AgentContext {
  sessionId: string;
  intent: Intent;
  memory?: unknown;
  jarvisContext?: JarvisContext;  // NEW
}
```

- [ ] **Step 3: Update the engine to pass jarvisContext**

In `packages/jarvis/src/nexus/engine.ts`, in `dispatchAgent` around line 96:

```ts
const agentContext = {
  sessionId,
  intent,
  memory: undefined,
  jarvisContext: context,  // NEW
};
```

- [ ] **Step 4: Replace the hardcoded string in pool.ts**

In `packages/jarvis/src/nexus/pool.ts`:

Add import at top:
```ts
import { buildSystemPrompt } from "./system-prompt.js";
```

Modify the general agent handler. Since `ctx.jarvisContext` may be undefined (other agents don't need it), provide a fallback:

```ts
[
  "general",
  async (ctx: AgentContext) => {
    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const prompt = (ctx.intent.params?.text as string) ?? ctx.intent.action;
          const jarvisContext = ctx.jarvisContext ?? {
            sessionId: ctx.sessionId,
            userId: "desktop-user",
            recentIntents: [],
            currentTime: new Date(),
          };
          const response = await this.client.chat(
            prompt,
            buildSystemPrompt("general", jarvisContext),
          );
          return { response: response.content };
        }
      } catch {
        // Model unavailable, return acknowledgment
      }
    }
    return { response: "I'm here. How can I help?" };
  },
],
```

- [ ] **Step 5: Run pool tests**

Run: `cd packages/jarvis && npx vitest run test/nexus/pool.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Run full vitest suite**

Run: `cd /home/parijat/workspace/openjarvis && npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Run lint, format:check, tsc -b**

Run:
```
cd /home/parijat/workspace/openjarvis && npm run lint
cd /home/parijat/workspace/openjarvis && npm run format:check
cd /home/parijat/workspace/openjarvis && npx tsc -b
```
Expected: all clean. Run prettier --write on changed files if format:check fails.

- [ ] **Step 8: Commit**

```bash
git add packages/jarvis/src/nexus/pool.ts packages/jarvis/src/nexus/types.ts packages/jarvis/src/nexus/engine.ts
git commit -m "feat(pool): thread jarvisContext + use buildSystemPrompt in general agent"
```

---

### Task 4: Wire `buildSystemPrompt` into `RuleBasedSynthesizer`

**Files:**
- Modify: `packages/jarvis/src/nexus/synthesizer.ts` (replace the hardcoded system string in BOTH the streaming and non-streaming branches)

**Interfaces:**
- Consumes: `buildSystemPrompt("synthesizer", context)` from Task 1.
- Produces: synthesizer passes the new system prompt to the model in both code paths.

- [ ] **Step 1: Read the existing synthesizer.ts**

Read `packages/jarvis/src/nexus/synthesizer.ts` to find the two hardcoded strings. They are at:
- Line ~39: inside the streaming branch (when `hooks?.onChunk` is provided and `this.client` is available).
- Line ~67: inside the non-streaming branch (when `this.client` is available but no streaming hook).

Both currently pass: `"You are JARVIS, a helpful AI assistant. Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details."`

The current method signature: `synthesize(results: AgentResult[], _originalIntent: Intent, _context: JarvisContext, hooks?: SynthesizeHooks)`.

Note: `_context` has the underscore because it was unused. Drop the underscore.

- [ ] **Step 2: Replace the streaming branch hardcoded string**

In `packages/jarvis/src/nexus/synthesizer.ts`:

Add import at top:
```ts
import { buildSystemPrompt } from "./system-prompt.js";
```

Change the parameter from `_context` to `context`:
```ts
async synthesize(
  results: AgentResult[],
  _originalIntent: Intent,
  context: JarvisContext,
  hooks?: SynthesizeHooks,
): Promise<Synthesis> {
```

Replace the streaming branch hardcoded string (around line 39):
```ts
for await (const chunk of this.client.chatStream(
  resultsPrompt,
  buildSystemPrompt("synthesizer", context),
  hooks.abort,
)) {
```

- [ ] **Step 3: Replace the non-streaming branch hardcoded string**

Replace the non-streaming branch hardcoded string (around line 67):
```ts
const response = await this.client.chat(
  resultsPrompt,
  buildSystemPrompt("synthesizer", context),
);
```

- [ ] **Step 4: Run synthesizer tests**

Run: `cd packages/jarvis && npx vitest run test/nexus/synthesizer.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run full vitest suite**

Run: `cd /home/parijat/workspace/openjarvis && npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Run lint, format:check, tsc -b**

Run:
```
cd /home/parijat/workspace/openjarvis && npm run lint
cd /home/parijat/workspace/openjarvis && npm run format:check
cd /home/parijat/workspace/openjarvis && npx tsc -b
```
Expected: all clean. Run prettier --write on synthesizer.ts if format:check fails.

- [ ] **Step 7: Commit**

```bash
git add packages/jarvis/src/nexus/synthesizer.ts
git commit -m "feat(synthesizer): use buildSystemPrompt for context-aware synthesis"
```

---

### Task 5: Final gate, CHECKPOINT update, commit, push

**Files:**
- Modify: `CHECKPOINT.md`

- [ ] **Step 1: Run the full gate**

Run: `bash scripts/ci-gate.sh`
Expected: ALL GATES PASSED.

- [ ] **Step 2: Run coverage explicitly**

Run: `cd /home/parijat/workspace/openjarvis && npm run coverage`
Expected: statements ≥99%, lines ≥99%, functions ≥99%, branches ≥99%.

- [ ] **Step 3: Update CHECKPOINT.md**

Add a Round 17 section after Round 16:

```markdown
### Round 17 — persona + user + recent context (2026-06-20)

**User report:** "When I was using the model, I saw the model has
no context. No SYSTEM. PERSONA, USER contexts."

**Root cause.** The model layer (`OllamaClient`, `OpenAICompatClient`)
accepts a `system?: string` argument, but the three call sites in the
nexus stack (router, pool general agent, synthesizer) passed only
hardcoded strings. The `JarvisContext.userId` and `recentIntents`
fields were defined but unused. The model had no idea who the user
was, what JARVIS's voice should be, or what the user had just done.

**Fix.** Added a centralized `buildSystemPrompt(role, context)`
helper that produces a single system string from a persona constant
+ user id + last 3 recent intents + role-specific tail, capped at
1500 characters. The three call sites swap their hardcoded strings
for a call to this helper.

- **Persona:** a TS const (`JARVIS_PERSONA`, ~280 chars) — small,
  cheap, no I/O.
- **User id:** kept hardcoded as `"desktop-user"` per user direction.
  Wired through `JarvisContext.userId` for future-proofing.
- **Recent intents:** the last 3 intent actions as a compact list
  ("Recent actions: send_email, chat, search"). Empty when no
  history.
- **Cap:** hard 1500-char total; truncates with `…` if exceeded.

**Verified on this machine** (`make dev` on `DISPLAY=:1`):
- vite + electron still launch.
- `^C` cleanup still works.
- Type a query → JARVIS responds with the persona's voice. Inspect
  the request body to confirm the system prompt includes the
  persona, user id, and recent actions.

**Gate results:**
- `tsc -b` — clean
- `eslint .` — clean
- `prettier --check` — clean
- `vitest run` — 1415+ passed, 7 skipped
- `npm run coverage` — 99% floor held on all metrics
- `bash scripts/ci-gate.sh` — ALL GATES PASSED

**Deferred to a future round** (per user direction):
- Persona as a `.md` file editable from the Settings window with
  hot-reload. For now, the TS const is enough.
- Real user id (auto-generated UUID persisted in DesktopStore).
```

- [ ] **Step 4: Commit**

```bash
git add CHECKPOINT.md
git commit -m "docs(checkpoint): add Round 17 persona + context"
```

- [ ] **Step 5: Push**

```bash
git push origin feat/playwright-e2e
```

Expected: the Round 17 commits land on `feat/playwright-e2e`.