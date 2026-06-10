# S1 — Core Runtime + Grounding Engine (GroundingEngine) — Design

**Date:** 2026-06-05
**Status:** Draft for review
**Parent:** [`2026-06-05-openjarvis-design.md`](./2026-06-05-openjarvis-design.md) (umbrella)
**Subproject:** S1 of the build order (§9 of the umbrella)

> S1 is the foundation **and** the direct fix for the #1 pain point (P1:
> hallucination when the model doesn't call tools). It delivers the core runtime,
> the **GroundingEngine** grounding engine, event-sourced replay/eval, and the _interfaces_
> for the S1 security foundations — proven end-to-end by a thin vertical slice on
> Windows, macOS, and Linux.

---

## 1. Scope

### 1.1 In scope (S1)

1. **`@openjarvis/core`** package: the agent loop, session model, event bus,
   typed tool registry, model-adapter interface, and the GroundingEngine grounding engine.
2. **Model adapters:** **Ollama (local + `:cloud`) is mandatory**, plus **one
   second adapter** to prove provider-agnosticism (decision: an
   **OpenAI-compatible** adapter, since Groq/OpenRouter/local servers and many
   free tiers speak that wire format — one adapter unlocks several providers).
3. **GroundingEngine grounding engine** (§6): native tool-calling, grounding modes,
   tool-required enforcement, claim-citation verification, structured outputs,
   the "unknown" path.
4. **Event sourcing + deterministic replay + eval harness** (§7) — designed in
   from turn one (umbrella §10.1).
5. **Security foundation _interfaces_** (§8): `Vault` (the Vault), capability
   model (the Lab), taint tags (the Gate), single-writer session, append-only
   hash-chained audit (Audit). S1 ships the interfaces + a minimal local
   implementation; full hardening lands in later subprojects.
6. **Cross-platform proof** + a **Bun `--compile` spike** (§9).
7. **The vertical slice** (§3): one agent, one real tool, grounding enforced,
   fully replayable, passing on all three OSes.

### 1.2 Out of scope (deferred to later subprojects)

- The Nexus orchestrator and the 5-phase Pulse (**S3**).
- Multiple agents, in-process multi-agent dispatch (**S3**).
- Durable SQLite state ledger / JarvisStateStore, JarvisMemoryStore memory store (**S2**) — S1 uses an
  in-memory event store behind the same interface; S2 swaps in SQLite.
- Channels, gateway, dashboard, plugin loader, packaging (**S4–S7**).
- Sandboxed process isolation for tools (**S6 hardening**) — S1 defines the
  capability contract and enforces it in-process.

---

## 2. Goals & non-goals for S1

**Goals**

- A model **cannot** emit a final answer to a grounding-required task without a
  successful, schema-valid tool call whose result its answer cites. Proven by an
  automated test that would otherwise hallucinate.
- The same agent runs identically on a free local Ollama model, an Ollama cloud
  model, and an OpenAI-compatible endpoint — no code change, only config.
- Every run is recorded as an event log and can be **replayed deterministically**
  (same inputs → same decisions) and asserted on by the eval harness.
- The runtime, not the model, owns grounding, session integrity, capability
  checks, and audit.

**Non-goals**

- Not optimizing latency/cost yet (correctness first).
- Not building the full sandbox/RBAC enforcement (interfaces only in S1).
- No UI — the slice is exercised via the eval harness + a tiny CLI driver.

---

## 3. The vertical slice (walking skeleton) — S1's definition of done

A single agent, `probe-agent`, with exactly one tool, `disk_free`, and one skill,
`host-facts`, declared `grounding: required`.

**The hallucination test (the headline acceptance):**

```
GIVEN  probe-agent on any model (free local Ollama incl.)
WHEN   asked "How much disk space is free on this machine?"
THEN   the runtime REJECTS any final answer produced before `disk_free` is
       called successfully, re-prompting GroundingEngine's correction;
AND    the accepted final answer cites the `disk_free` tool-result id;
AND    the number in the answer equals the tool result (claim-citation check);
AND    the entire run replays deterministically and the eval harness asserts all
       of the above — on Windows, macOS, and Linux.
```

A companion **negative control**: the same question with grounding _disabled_
demonstrates the model fabricating a plausible-but-wrong number — proving the
engine is what makes the difference (this becomes a regression fixture).

`disk_free` is implemented cross-platform via the OS-abstraction layer
(`os.freemem`/`statfs` equivalents; `wmic`/`Get-PSDrive` vs `df` as needed).

---

## 4. Package & module layout (`@openjarvis/core`)

```
packages/core/
  src/
    session/
      session.ts          # Session aggregate: single-writer, event-sourced
      events.ts           # Event types + the append-only log interface
      replay.ts           # Rebuild session state from events; deterministic replay
    loop/
      agent-loop.ts       # The turn state machine
      turn.ts             # Turn lifecycle types
    models/
      adapter.ts          # ModelAdapter interface + shared types
      ollama.ts           # Ollama adapter (local + :cloud, one code path)
      openai-compat.ts    # OpenAI-compatible adapter (Groq/OpenRouter/local/etc.)
      tiering.ts          # model-tier policy (grounding-critical -> stronger)
    tools/
      registry.ts         # Typed tool registry (Zod schemas)
      tool.ts             # Tool definition + ToolResult types
      tojsonschema.ts     # Zod -> provider-native tool schema
    grounding/
      eleven.ts           # The Grounding engine (modes + enforcement loop)
      citations.ts        # claim-citation extraction + verification
      verifier.ts         # optional second-pass verifier agent
    security/
      vault.ts            # the Vault: secrets interface (+ keychain/file impls)
      capability.ts       # the Lab: capability grants + checks
      taint.ts            # the Gate: provenance/taint tags on content
      audit.ts            # Audit: append-only hash-chained audit log
    os/
      platform.ts         # OS detection + shell/pkgmgr/path abstraction
    index.ts
  test/
    grounding.eval.test.ts  # the hallucination test + negative control
    replay.test.ts
    ...
```

---

## 5. Core domain model

These are the contracts everything else depends on. (Zod-validated; types shown
in TS shorthand.)

### 5.1 Messages, turns, sessions

```ts
type Role = "system" | "user" | "assistant" | "tool";

interface Message {
  role: Role;
  content: ContentPart[]; // text + structured parts
  provenance: Provenance; // the Gate: where this content came from
}

interface ToolCall {
  id: string;
  tool: string;
  args: unknown;
} // args validated by registry
interface ToolResult {
  id: string;
  tool: string;
  ok: boolean;
  data: unknown;
  error?: string;
}

interface Turn {
  id: string;
  input: Message;
  modelCalls: ModelCall[]; // 1..n (re-prompts count)
  toolCalls: { call: ToolCall; result: ToolResult }[];
  final?: Message; // present only once accepted by GroundingEngine
  grounding: GroundingOutcome; // why it was accepted / what was enforced
}

interface Session {
  // single-writer aggregate (§8.4)
  id: string;
  agentId: string;
  turns: Turn[];
  // state is a fold over the event log — never mutated directly
}
```

### 5.2 Provenance / taint (the Gate)

```ts
type Trust = "system" | "operator" | "tool" | "external"; // external = untrusted
interface Provenance {
  trust: Trust;
  source: string;
  taint: boolean;
}
```

`external` content (future: channel messages, web pages, files) is `taint:true`.
The taint rule (umbrella §5.5.3) is enforced at the grounding/approval boundary:
a side-effecting action influenced by tainted content requires approval. In S1
there are no side-effecting tools, but the field and the rule exist so later
subprojects inherit them.

---

## 6. GroundingEngine — the Grounding engine (the centerpiece)

GroundingEngine sits **between the model and the acceptance of a final answer**. The agent
loop never accepts a model's "final" message directly; it asks GroundingEngine.

### 6.1 Grounding modes (per skill / per task)

```ts
type GroundingMode =
  | "off" // free chat; no enforcement (used for the negative control)
  | "preferred" // nudge toward tools; accept ungrounded answers but flag them
  | "required" // MUST have >=1 successful qualifying tool call before final
  | "cited"; // required + final answer must cite tool-result ids (strongest)
```

A skill manifest declares its mode (and optionally the set of _qualifying tools_).
`host-facts` in the slice is `cited`.

### 6.2 The enforcement loop

```
loop:
  modelOut = adapter.generate(messages, tools)        # native tool-calling
  if modelOut.toolCalls:
      validate args against registry schema           # reject -> corrective turn
      run tools (capability-checked) -> ToolResults
      append results to messages; continue loop
  else (model produced a "final"):
      verdict = eleven.evaluate(task, turn, mode)
      if verdict.accept: return final
      else: append verdict.correction as a system turn; continue loop
  enforce maxModelCalls budget -> on exceed, return a grounded failure
```

`eleven.evaluate` decides:

- **required:** is there ≥1 successful qualifying tool call this turn? If not →
  correction: _"You must call `<tool>` before answering. Do not guess."_
- **cited:** required + every factual claim must map to a tool-result id
  (§6.3). Uncited factual claims → correction listing them.
- **preferred:** accept, but attach a `flagged: ungrounded` marker for the audit.
- **the "unknown" path:** a grounded `unknown`/`needs-tool` answer is **accepted as
  success** — removing the incentive to fabricate.

### 6.3 Claim-citation verification (citations.ts)

- The model is instructed (and, where supported, structurally required) to emit
  final answers as **claims with citations**: `{ text, claims:[{ statement,
citesToolResultId }] }` (a Zod-structured output, §6.4).
- The verifier checks each `citesToolResultId` exists in this turn and that the
  claim is consistent with that result. v1 consistency check = a layered approach:
  exact/numeric match where possible (e.g. the disk number), else a cheap-model
  entailment check ("does result R support claim C?").
- Failures → correction or strip, per mode.

### 6.4 Structured outputs

For data answers, GroundingEngine asks the adapter for a **schema-constrained response**
(JSON-schema from Zod). Providers that support native structured output use it;
others get a "respond ONLY as this JSON" instruction + a parse/repair step. This
makes "fill fields from tool output" the path of least resistance vs. prose.

### 6.5 Model tiering & the optional verifier

- `tiering.ts`: a policy maps `grounding-critical` steps to a stronger configured
  model (incl. Ollama cloud) when available; otherwise stays on the default.
- `verifier.ts`: for high-stakes tasks, a second adapter pass adversarially checks
  the accepted answer against tool results before release. Off by default in S1
  (wired, tested, not on the slice's hot path).

### 6.6 Why this beats prose (ties to P1)

The model is _structurally unable_ to shortcut grounding: the runtime owns the
accept decision, validates tool args, and checks citations. Weak/free models —
which hallucinate most — are exactly the ones this protects, which is why GroundingEngine
is mandatory, not optional (umbrella §6.1).

---

## 7. Event sourcing, replay & eval harness

### 7.1 Event log

Every meaningful step is an append-only event:
`SessionStarted, TurnStarted, ModelRequested, ModelResponded, ToolValidated,
ToolCalled, ToolReturned, GroundingEvaluated, CorrectionIssued, FinalAccepted,
TurnEnded`. Session state is a **fold** over these events (no direct mutation →
§8.4 single-writer integrity for free).

In S1 the store is in-memory + JSONL file behind a `EventStore` interface; **S2
swaps in SQLite** with zero changes to callers.

### 7.2 Deterministic replay

- Model calls and tool calls are recorded with their inputs+outputs. Replay
  re-runs the loop **feeding recorded outputs** instead of calling the live model/
  tools → identical decisions. This is what makes runs debuggable and the eval
  harness deterministic despite non-deterministic models.
- Determinism boundary: anything non-deterministic (model output, clock, tool I/O)
  is captured as an event; the loop logic itself is pure over the event stream.

### 7.3 Eval harness

- A scenario = `{ prompt, recorded-or-live model, expected assertions }`.
- Assertions can target: "a `disk_free` call happened before any final",
  "final cites a tool result", "numeric claim equals tool result", "ungrounded
  answer was rejected".
- The hallucination test (§3) and its negative control are the first scenarios;
  they double as **regression fixtures** and as the home for future grounding
  evals. Runs in CI on all three OSes.

---

## 8. Security foundations (interfaces in S1)

S1 designs and minimally implements these so later subprojects inherit a safe
core (umbrella §5.5). Brand names in prose; functional ids in code.

### 8.1 the Vault — `Vault` (secrets)

```ts
interface Vault {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  // never returns secrets to logs/audit; values are redacted in events
}
```

Impls: `KeychainVault` (macOS Keychain / Windows Credential Manager / libsecret)
with a `FileVault` fallback (age/libsodium-encrypted, 0600). Config files refuse
secret values. The slice needs it for the OpenAI-compatible / Ollama-cloud key.

### 8.2 the Lab — capability model

```ts
interface Capability { name: "shell"|"network"|"fs:read"|"fs:write"|...; scope?: string }
interface AgentGrant { agentId: string; capabilities: Capability[] }
```

Each tool declares the capabilities it needs; the registry checks the calling
agent's grant **before** executing a tool. `probe-agent` is granted only what
`disk_free` needs. Default-deny.

### 8.3 the Gate — taint

Provenance/taint tags (§5.2) attached to all content; the taint→approval rule is
defined and unit-tested with a stub side-effecting tool, even though the slice
ships none.

### 8.4 Single-writer sessions

A session processes one turn at a time via a serialized queue/actor; concurrency
is across sessions only. Prevents the state corruption of P16. Enforced by the
event-sourced aggregate (state only changes by appending events through the
single writer).

### 8.5 Audit — audit

```ts
interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  verify(): Promise<boolean>;
}
```

Append-only, **hash-chained** (`entry.hash = H(prevHash + canonical(entry))`),
secret-redacted. Every grounding decision, tool call, and correction is audited.
`verify()` detects tampering. In-memory+JSONL in S1; durable in S2.

---

## 9. Cross-platform & the Bun spike

- **Bun `--compile` spike (first task in S1):** build the slice into a single
  binary for win/mac/linux; confirm `better-sqlite3`-class native deps and the
  keychain bindings work (or pick pure-JS/`bun:sqlite` alternatives). **Fallback:**
  Node SEA if a blocker appears. Decision recorded as an ADR in `docs/adr/`.
- **`os/platform.ts`**: detect OS; provide `freeDiskBytes()`, shell selection, and
  config/data dir resolution (XDG / `Application Support` / `%APPDATA%`).
- CI matrix: `{windows, macos, linux} × {node, bun}` runs `make check` + the
  grounding eval.

---

## 10. Testing & acceptance

| Gate                     | Requirement                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **Grounding (headline)** | §3 hallucination test passes; negative control shows fabrication; both are CI fixtures on 3 OSes |
| **Provider-agnostic**    | The slice passes unchanged on Ollama-local, Ollama-cloud, and an OpenAI-compatible endpoint      |
| **Replay**               | Any recorded run replays to identical decisions; eval harness is deterministic                   |
| **Session integrity**    | Concurrent turn submissions to one session serialize; no interleaving (property test)            |
| **Audit**                | `verify()` passes on clean logs, fails on a tampered entry                                       |
| **Capability**           | A tool call without the required grant is denied before execution                                |
| **Coverage / typing**    | Inherit the source's bar: strict TS, lint/format, high coverage                                  |

---

## 11. S1 milestones (suggested order for the implementation plan)

1. **S1.0** Monorepo scaffold (workspaces, TS strict, vitest, eslint/prettier, CI) + Bun spike + `os/platform.ts`.
2. **S1.1** Domain model + event store + single-writer session + replay.
3. **S1.2** Tool registry (Zod → native schema) + capability checks + `disk_free`.
4. **S1.3** Model-adapter interface + Ollama (local+cloud) + OpenAI-compat + Vault for keys.
5. **S1.4** Agent loop + native tool-calling round-trip (no grounding yet).
6. **S1.5** **GroundingEngine**: modes, enforcement loop, citations, structured output, the "unknown" path.
7. **S1.6** Audit audit (hash-chained) + Gate taint tags + redaction.
8. **S1.7** Eval harness + the hallucination test + negative control; CI on 3 OSes; green.

Each milestone is independently reviewable; S1.6 (GroundingEngine) is the keystone.

---

## 12. Decisions (resolved 2026-06-05)

1. **Second adapter = OpenAI-compatible.** One adapter covers Groq / OpenRouter /
   local OpenAI-compatible servers and many free tiers. Anthropic-native is a
   later add (it can also be reached via OpenAI-compatible proxies meanwhile).
2. **Claim-consistency depth (S1) = numeric + existence checks; entailment behind
   a flag.** S1 verifies that cited tool-result ids exist and that numeric/exact
   claims match the result. The cheap-model entailment check is implemented but
   **off by default** (feature-flagged), promoted in S2.
3. **Structured-output fallback = yes.** Providers with native structured output
   use it; others get "respond ONLY as this JSON" + a parse/repair step.
4. **Secrets in S1 = encrypted `FileVault`; keychain interface ready.** Ship the
   age/libsodium-encrypted 0600 `FileVault` now behind the `Vault` interface;
   `KeychainVault` lands in S6 hardening without changing callers.
5. **CI matrix = Bun + Node from S1.0**, across {windows, macos, linux}.

---

## 13. Dependencies on the umbrella decisions (already locked)

Bun (spike) · Zod · Ollama local+cloud + OpenAI-compat · SQLite-default (S2; S1
in-memory behind the interface) · MIT · OpenJarvis naming (GroundingEngine, the Gate,
the Lab, the Vault, Hopper, Audit) per [`docs/branding.md`](../branding.md).
