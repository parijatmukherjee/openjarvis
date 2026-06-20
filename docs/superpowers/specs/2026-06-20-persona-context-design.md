# Threading Persona + User + Recent-Intent Context Through the Model

## Problem

The model layer (`OllamaClient`, `OpenAICompatClient`) accepts a
`system?: string` argument, but the three call sites in the nexus
stack pass only hardcoded strings:

- `router.ts:58` — `"You are an intent classifier. Respond with JSON: ..."`.
- `pool.ts:208` — `"You are JARVIS, a helpful AI assistant. Respond concisely."`.
- `synthesizer.ts:39,67` — `"You are JARVIS, a helpful AI assistant. Synthesize ..."`.

As a result, the model receives no information about:
- **PERSONA**: who JARVIS is, how to speak, what voice/tone.
- **USER**: who the user is (even just an opaque id).
- **RECENT**: what the user just did.

User report: "When I was using the model, I saw the model has no
context. No SYSTEM. PERSONA, USER contexts."

## Decision

Add a centralized `buildSystemPrompt(role, context)` helper that
produces a single system string from a persona constant + user id +
recent intents + role-specific tail, capped at 1500 characters. The
three call sites swap their hardcoded string for a call to this
helper.

Persona is a TS const (not a `.md` file). The user prefers the
smallest possible context footprint; a TS const is cheaper than
loading a file and editing support is a separate round.

## Scope

In scope:
- New file `packages/jarvis/src/nexus/system-prompt.ts` exporting
  `buildSystemPrompt(role: SystemPromptRole, context: JarvisContext): string`.
- New constant `JARVIS_PERSONA` (~250 chars) at the top of that file.
- Replace the three hardcoded strings (router, pool general agent,
  synthesizer ×2 [streaming + non-streaming branches]).
- Tests for `buildSystemPrompt`:
  - Includes persona + user id + recent intents.
  - Truncates with `…` when total exceeds 1500 chars.
  - Empty `recentIntents` is handled (omits the line).
  - Role-specific tail differs across roles.
- CHECKPOINT update.

Out of scope (intentionally deferred):
- `.md` file for persona; settings-panel editor; hot-reload. User
  approved deferring these to a later round.
- Changing `userId` from hardcoded `"desktop-user"` to a real value.
- Multi-turn conversation memory beyond `recentIntents` (engine is
  still single-shot per intent).
- Token-level measurement or `token`-aware trimming. Char cap is the
  simple heuristic; a real tokenizer would be overkill for ~400
  tokens of context.
- The non-streaming `chat()` path error-code divergence noted in
  Round 16's CHECKPOINT.

## Architecture

```
engine.execute(intent, context, hooks?)
   ├─ router.route(intent, context)         [client.chat(prompt, buildSystemPrompt("router", context))]
   ├─ pool.execute(route, agentContext)     [client.chat(prompt, buildSystemPrompt("general", context))]
   └─ synthesizer.synthesize(results, intent, context, hooks)
        ├─ streaming:  client.chatStream(prompt, buildSystemPrompt("synthesizer", context), abort)
        └─ non-stream: client.chat(prompt, buildSystemPrompt("synthesizer", context))
```

`buildSystemPrompt` is a pure function — no I/O, no model client
dependency — so it's trivially testable and tree-shakeable.

## Data shape

```ts
// packages/jarvis/src/nexus/system-prompt.ts
export type SystemPromptRole = "router" | "general" | "synthesizer";

const JARVIS_PERSONA = `You are JARVIS (Just A Rather Very Intelligent System), a concise, helpful AI assistant. Speak with dry British wit. Prefer short, direct answers. Avoid hedging. If you don't know, say so.`;

const ROLE_TAILS: Record<SystemPromptRole, string> = {
  router: "You are an intent classifier. Respond with JSON: { action: '<action>', confidence: <0.0-1.0> }. Valid actions follow.",
  general: "Respond concisely to the user's question.",
  synthesizer: "Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
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
    .filter(Boolean);
  const recent = recentActions.length > 0
    ? `Recent actions: ${recentActions.join(", ")}`
    : "";
  const tail = ROLE_TAILS[role];
  const parts = [JARVIS_PERSONA, user, recent, tail].filter(Boolean);
  const joined = parts.join("\n\n");
  if (joined.length <= SYSTEM_PROMPT_MAX_CHARS) return joined;
  return joined.slice(0, SYSTEM_PROMPT_MAX_CHARS - 1) + "…";
}
```

## Failure modes

- **recentIntents overflows the char cap.** If the three most
  recent action names are very long, the cap truncates from the end
  with `…`. Persona + role tail always come first; recent intents
  are first to be trimmed.
- **Empty recentIntents.** The "Recent actions" line is omitted
  entirely; no `"Recent actions: "` placeholder.
- **Model client not available.** No change — `RuleBasedRouter` and
  `RuleBasedSynthesizer` already fall back to rule-based logic
  when `this.client` is undefined or `isAvailable()` returns false.
- **Hardcoded userId.** No change. The user explicitly approved
  hardcoding `"desktop-user"`.

## What stays the same

- `ModelClient.chat()` and `chatStream()` interfaces — unchanged.
- `JarvisContext` shape — unchanged. Already has `userId`,
  `recentIntents`, `location`, `currentTime`.
- The existing non-streaming `chat()` / streaming `chatStream()`
  call paths — only the `system` argument changes.
- All existing tests for router / pool / synthesizer / model
  clients. The new system prompt is a different string but does not
  change the *shape* of the model request, so fetch mocks that
  assert body shape keep passing.
- Round 16 streaming work.

## Testing strategy

TDD, per `AGENT.md`:

1. New file `packages/jarvis/test/nexus/system-prompt.test.ts` with
   tests for `buildSystemPrompt`:
   - Includes the persona, user id, recent intents, and role tail.
   - Empty `recentIntents` produces no "Recent actions" line.
   - Truncates with `…` when total exceeds 1500 chars.
   - Different roles produce different role tails.
2. Existing tests for `nexus/router.test.ts`, `nexus/pool.test.ts`,
   `nexus/synthesizer.test.ts` must keep passing. They assert on
   the model request body shape, not the exact system string, so
   they should not need updates.

Coverage target: 99% statements / 99% lines / 100% functions / 99%
branches (unchanged from current gate).

## How to verify

1. Run `npm run coverage` — all metrics stay above 99%.
2. Run `make dev` — type a few messages, see JARVIS respond with
   the persona's voice. Verify with a query like "What's the
   weather?" that the model sees the user id and recent actions.
3. Inspect the request body (via dev tools or a temporary
   console.log) and confirm the system prompt includes:
   - "Just A Rather Very Intelligent System"
   - "User: desktop-user"
   - "Recent actions: <last 3>"
   - the role-specific tail.

## Why this design

- **Smallest possible context footprint.** A TS const is faster
  and cheaper than reading a `.md` file at startup. The user
  prioritized "if TS file reduces context, use that".
- **Single source of truth.** All three call sites share the same
  persona + user + recent structure, so the helper enforces a
  consistent shape across the model layer.
- **Trivial to extend.** When the user wants `.md` files + settings
  UI later, replace the `JARVIS_PERSONA` const with a file read
  inside `buildSystemPrompt` — no call-site changes.
- **Pure function.** `buildSystemPrompt` has no side effects, so
  it's trivially testable and doesn't need a model client.
- **Backwards-compatible.** The shape of the model request body
  doesn't change; only the `system` argument content.