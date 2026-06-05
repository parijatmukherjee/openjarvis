# OpenHawkins — Design & Plan

**Date:** 2026-06-05
**Status:** Draft for review
**Author:** Parijat Mukherjee (with Claude)
**Source pattern:** [`openclaw-hawkins`](../../../openclaw-hawkins) (multi-agent orchestration on top of the OpenClaw runtime)

---

## 1. One-paragraph thesis

OpenHawkins is a self-owned AI-agent platform. Where `openclaw-hawkins` is an
*orchestration layer that rides on top of the external OpenClaw runtime* (it
shells out to `openclaw agent --agent <id> --message …`), OpenHawkins **owns the
runtime itself** — the agent loop, model adapters, the tool/skill engine, durable
state, shared memory, the chat channels, and the dashboard. The Hawkins pattern
(Nexus + Tendrils + VINES + VECNA) becomes the *core*, not a plugin. The guiding
principle: **the runtime enforces what OpenClaw left to the LLM's discretion** —
tool-calling, grounding, state transitions, memory injection, permissions, and
concurrency. The model proposes; the runtime enforces.

---

## 2. Goals & non-goals

### Goals
1. **Own the runtime.** No dependency on the external OpenClaw gateway.
2. **Kill hallucination at the root** via a runtime-enforced *Grounding* system
   (the user's #1 pain point: models hallucinate when they don't use tools, even
   with clear skill instructions).
3. **Cross-platform, installs anywhere, works perfectly** — Windows, macOS, Linux.
   No hard MariaDB dependency; zero-config default.
4. **Telegram + Discord native** as first-class chat channels.
5. **Beautiful, motion-rich dashboard** (Astro) replacing the Linear dependency
   for operator oversight — built with the `emil-design-eng`, `impeccable`, and
   `design-taste-frontend` skills.
6. **Feature parity with the openclaw-hawkins pattern**: Nexus orchestration,
   6 Tendrils, durable state (VINES), decay-aware memory (VECNA), operator
   oversight.
7. **Keep the strengths** of the source repo: TypeScript, strict typing, high
   test coverage, clean module boundaries.

### Non-goals (for v1)
- Writing a model *inference* engine. We sit on top of provider SDKs
  (Anthropic / OpenAI / Ollama) and own everything *above* the raw model call.
- A general-purpose agent *framework* for third parties (we may expose a plugin
  API later, but v1 is a product, not a framework).
- Voice channels, mobile apps (future).
- Distributed/multi-host clustering in v1 (single-host daemon; design leaves the
  door open via pluggable Postgres/MariaDB state).

---

## 3. Problems with OpenClaw / the source architecture (and how OpenHawkins fixes each)

This is the analysis the project was started to produce. Each problem below is
derived from reading the `openclaw-hawkins` source (`src/dispatcher.ts`,
`orchestrator/AGENTS.md`, `skills/`, `vines/`, `vecna/`).

| # | Problem (OpenClaw / source) | Root cause | OpenHawkins fix |
| --- | --- | --- | --- |
| **P1** | **Models hallucinate when they don't call tools**, even with clear skill instructions. | Skills/`AGENTS.md` are *passive prose* injected into context. Tool-use is *optional* — the model decides. Weak local models (kimi-k2, gemma via ollama) answer from parametric memory. No grounding check. | **The Grounding engine** (§5) — runtime-enforced tool-required skills, claim-citation verification, structured outputs, and an "I-don't-know / call-a-tool" path. The runtime *rejects* ungrounded final answers and re-prompts. |
| **P2** | **Dispatch is subprocess-based and fragile.** `dispatchSpecialist` runs `openclaw agent … --json`, parses stdout. | Brittle: PATH/ENOENT, JSON parse failures, 16 MB buffer cap, no streaming, timeout = SIGTERM kill, no mid-flight cancellation. | **In-process dispatch** over a typed message bus. Streaming token + tool-call events, cancellation, structured results — no subprocess, no stdout parsing. |
| **P3** | **No streaming / no progress.** Synchronous request→response with a hard timeout; the Nexus blocks on a subprocess. | The runtime has no event model. | **Event-sourced runtime.** Every turn emits `token`, `tool_call`, `tool_result`, `phase`, `state` events over WebSocket to channels + dashboard. |
| **P4** | **Hard MariaDB dependency** for durability (VINES + VECNA). | Both subsystems require a MariaDB instance. | **Embedded SQLite by default** (zero-config, cross-platform). MariaDB/Postgres as *opt-in* for multi-host. Storage is a pluggable driver. |
| **P5** | **State & memory are bolt-ons the LLM must remember to call.** VINES/VECNA are CLIs the orchestrator invokes via bash; if the model forgets `vines set-state`, state drifts. | Durability depends on LLM discipline. | **Runtime-owned state & memory.** The orchestrator engine writes state transitions automatically as it drives the Pulse. Memory is **auto-injected** each turn — no manual `vecna recall` paste. |
| **P6** | **Operator oversight requires Linear** (third-party SaaS). | No built-in UI. | **Built-in Astro dashboard** + local event store. Linear/GitHub Issues become optional *exporters*, not the source of truth. |
| **P7** | **Concurrency is prose, not enforced.** "No more than 2 dispatches", "sequential by default" live in `AGENTS.md`. | The model is asked to self-limit. | **Runtime scheduler** with enforced concurrency limits, queueing, and backpressure. |
| **P8** | **Permissions are convention, not sandbox.** Tendrils are full agents with shell access; "never auto-send" is a prose rule. | No capability gating. | **Capability sandbox.** Each agent gets a typed, scoped tool surface enforced by the runtime. Side-effecting tools (send email, post to Discord) require an explicit approval gate the runtime mediates. |
| **P9** | **Linux-only assumptions.** `system-agent` = apt/systemd/ufw/cron; `setup.sh` is bash; paths assume `~/.openclaw`. | Built for one OS. | **OS-abstraction layer.** Platform detection; package-manager abstraction (apt/brew/winget/choco); pwsh vs bash; OS-appropriate config dirs (XDG / AppData / Library). |
| **P10** | **No typed tool contract at the engine boundary.** Tool calls are free-form bash via `exec`; TypeBox validation exists only inside the plugin. | Tools aren't first-class at the runtime. | **Typed tool registry.** Every tool has a JSON-schema (TypeBox/Zod) for args + result; the runtime validates both directions and feeds schemas to the model as native tool definitions. |
| **P11** | **Manual memory injection.** VECNA recall must be pre-fetched and pasted into the prompt. | Context assembly is the model's job. | **Automatic context assembly.** The runtime retrieves relevant memory (topic + embedding similarity) and injects it into the system prompt before each turn. |
| **P12** | **No observability / eval / replay.** Post-mortem = reading `.jsonl` session files by hand. | No trace store. | **Trace store + replay.** Token accounting, cost, latency per orchestration; deterministic replay; eval harness. Surfaced in the dashboard. |

---

## 4. Architecture

A single TypeScript monorepo (pnpm/npm workspaces), distributed as a
**single binary per OS**. Everything in-process; the only external processes are
optional (an Ollama server, an opt-in Postgres/MariaDB).

```
                         ┌───────────────────────────────────────┐
        operator ───────►│  CHANNELS  (Telegram · Discord · CLI · │
                         │            WebSocket for dashboard)     │
                         └───────────────────┬───────────────────┘
                                             │ typed session messages
                         ┌───────────────────▼───────────────────┐
                         │      ORCHESTRATOR  (the Nexus)         │
                         │  routing · Pulse engine · synthesis    │
                         │  (logic in code — not prose AGENTS.md) │
                         └───────┬───────────────────────┬───────┘
                                 │ in-process dispatch    │ auto state/memory
              ┌──────────────────┼──────────┐            │
        ┌─────▼────┐ ┌────▼────┐ ┌────▼─────┐ …          │
        │ system   │ │ code    │ │ research │  TENDRILS  │
        │ tendril  │ │ tendril │ │ tendril  │ (in-proc)  │
        └────┬─────┘ └────┬────┘ └────┬─────┘            │
             │ every agent runs on ↓  │                  │
       ┌─────▼──────────────────────────────────────┐    │
       │  CORE RUNTIME                               │    │
       │  • agent loop (turn = think→tools→answer)   │    │
       │  • model adapters (Anthropic/OpenAI/Ollama) │    │
       │  • typed tool registry + native tool-calling│    │
       │  • GROUNDING engine  ◄── kills hallucination │   │
       │  • capability sandbox + approval gates      │    │
       │  • event bus (token/tool/phase/state)       │    │
       └─────────────────────┬───────────────────────┘    │
                             │                             │
       ┌─────────────────────▼─────────────────────────────▼──────┐
       │  STATE (VINES)             │   MEMORY (VECNA)             │
       │  durable orchestration row │   decay-aware shared memory  │
       │  runtime-owned transitions │   auto-injected each turn    │
       │  SQLite default / PG opt-in│   SQLite+embeddings default  │
       └───────────────────────────────────────────────────────────┘
                             │
              ┌──────────────▼───────────────┐
              │  DASHBOARD (Astro, motion-rich)│  ◄── real-time over WebSocket
              │  Pulse board · tendrils · mem  │
              │  traces · cost · replay        │
              └────────────────────────────────┘
```

### 4.1 Packages

| Package | Responsibility | Key deps |
| --- | --- | --- |
| `@openhawkins/core` | Agent loop, model adapters, typed tool registry, **Grounding engine**, capability sandbox, event bus | `@anthropic-ai/sdk`, `openai`, ollama client, `zod`/`typebox` |
| `@openhawkins/state` | VINES reborn — durable orchestration ledger, runtime-owned transitions, recovery | `better-sqlite3` (default), `pg`/`mariadb` (opt-in) |
| `@openhawkins/memory` | VECNA reborn — fragments, decay ranking, embeddings, auto-injection | sqlite-vec / local embeddings |
| `@openhawkins/orchestrator` | The Nexus — routing, the Pulse engine (in code), synthesis | core, state, memory |
| `@openhawkins/tendrils` | 6 specialist agent definitions + scoped tool surfaces | core |
| `@openhawkins/channels` | Telegram (grammY), Discord (discord.js), CLI, WebSocket adapters | grammY, discord.js, ws |
| `@openhawkins/dashboard` | Astro app — real-time operator UI | Astro, view-transitions, motion lib |
| `@openhawkins/gateway` | The daemon: wires channels↔orchestrator↔core, serves dashboard + WS | fastify/hono |
| `@openhawkins/plugin-sdk` | The **public extension contract** — types + helpers third parties build against (Tendrils, tools, channels, model adapters, storage drivers, dashboard widgets, skills) | core types only |
| `@openhawkins/registry` | Plugin loader + resolver + capability gating + (future) marketplace client | plugin-sdk, core |
| `@openhawkins/cli` | `openhawkins` command (start/stop/config/agent/**plugins**/doctor) | commander |

### 4.2 Why in-process beats subprocess dispatch
The single biggest structural change from the source. Subprocess dispatch
(`execFile('openclaw', …)`) cannot stream, cannot cancel cleanly, caps output at
16 MB, and turns every failure into an opaque exit code. In-process agents share
a typed event bus: the orchestrator sees every token and tool call live, can
cancel, can enforce concurrency, and never parses stdout. The
`DispatchResult` contract from the source survives as a typed interface.

---

## 5. The Grounding engine — the anti-hallucination centerpiece

This is the feature that directly answers the user's pain point. It is a stack
of runtime-enforced layers, not a prompt.

1. **Native tool-calling, not prose.** Tools are registered with JSON schemas and
   handed to the model via provider-native function/tool-calling
   (Anthropic tool use, OpenAI tools, Ollama tool calling). The model emits a
   structured tool call; the runtime validates args against the schema and
   executes. No "remember to run `df`" hope-and-pray.

2. **Tool-required skills.** A skill manifest can declare
   `grounding: required` (optionally naming specific tools). For such a task the
   runtime **will not accept a final answer until at least one qualifying tool
   call has succeeded.** If the model tries to answer first, the runtime injects
   a corrective turn: *"You must call `<tool>` before answering."*

3. **Claim-citation verification.** For factual/data answers the final message
   must reference tool-result IDs. A cheap verification pass (rules + a small
   model) checks that asserted facts trace to a tool output. Ungrounded claims
   are flagged, and the runtime either strips them or forces a re-grounding turn.

4. **Structured outputs.** When the answer is data (a status, a count, a table),
   the runtime forces a JSON-schema response so the model fills fields from tool
   outputs rather than composing prose it can fabricate.

5. **Explicit "unknown" path.** Skills instruct: *prefer calling a lookup/search
   tool, or return `unknown`, over guessing.* The runtime treats a grounded
   "unknown" as success, not failure — removing the incentive to fabricate.

6. **Model tiering.** Grounding-critical tasks route to stronger models; cheap
   local models handle only low-stakes chat. The adapter layer makes tier a
   policy, not a hard-coded model id.

7. **Optional verifier agent.** For high-stakes orchestrations, a second pass
   (separate agent) adversarially checks the first's claims against tool outputs
   before the Nexus reports — mirroring the "verification-before-completion"
   discipline.

**Acceptance test for the Grounding engine (Subproject 1 exit criteria):** a
deliberately under-instructed agent asked a question it would normally fabricate
(e.g. "how much disk is free?") must be *unable* to answer without calling the
disk tool, and its answer must cite the tool result — verified by an automated
test on all three OSes.

---

## 6. Cross-platform strategy

- **TypeScript everywhere**; single-binary build per OS (Bun `--compile` or Node
  SEA — decided in Subproject 1 after a spike; both keep the TS source).
- **Embedded SQLite default** (`better-sqlite3` or `bun:sqlite`) → no MariaDB
  install required. The source's MariaDB schemas port to SQLite; PG/MariaDB stay
  available via a storage-driver interface for multi-host operators.
- **OS-abstraction layer** in `core`:
  - platform detection; package-manager abstraction
    (`apt`/`dnf` · `brew` · `winget`/`choco`);
  - shell abstraction (bash/zsh vs PowerShell);
  - config/data dirs via OS conventions (XDG on Linux, `Library/Application
    Support` on macOS, `%APPDATA%` on Windows).
- **`system-agent` becomes OS-aware**: the Linux-only "apt/systemd/ufw/cron"
  scope generalizes; the agent inspects the host and picks the right commands.
- **Installers:** Homebrew tap, Scoop/winget manifest, `curl | sh`, and `npm i -g`.

---

## 7. Channels: Telegram + Discord

- **Telegram** via grammY (modern, typed). **Discord** via discord.js.
- Each channel maps a chat/thread → an orchestrator **session** (multi-turn,
  resumable). Streaming replies (edit-in-place message updates as tokens arrive).
- **Approval gates** surface as inline buttons: the `comm-agent`'s "draft → send
  it?" becomes a Telegram/Discord button the runtime mediates — no auto-send.
- **Media passthrough:** images/files routed to the `vision-agent`.
- A `telegram` Claude-Code plugin already exists in this environment and can seed
  patterns (token storage, allowlist/policy), but OpenHawkins ships its own
  channel adapters.

---

## 8. Dashboard (Astro, motion-rich)

Built with the three installed design skills — **`emil-design-eng`** (motion &
polish), **`impeccable`** (anti-AI-slop design language), **`design-taste-frontend`**
(metric-based component architecture).

Views:
- **The Pulse board** — live orchestrations through the 5 phases (Sensitivity →
  Anchoring → Deep Seeking → Connection → Consolidation), animated transitions.
- **Tendrils** — per-specialist activity, current task, token/latency.
- **Memory (VECNA)** — browse/search fragments, importance, decay, evolution graph.
- **Traces & replay** — step through any orchestration; token + cost accounting.
- **Settings** — models, channels, capability/approval policy.

Design intent: real-time, fluid, sub-300ms interactions, custom easing, no
generic AI-dashboard look. Replaces Linear as the oversight surface (Linear/GitHub
become optional exporters).

---

## 8.5 Plugin system & marketplace

OpenHawkins is **extensible by design** and aims, in the future, to host a
**community marketplace** where authors submit plugins. This is not a v1
afterthought — it shapes the runtime now, because a stable, versioned extension
contract and a real capability sandbox must exist *before* third-party code runs
on a user's machine.

### 8.5.1 What is a plugin?
A plugin is a versioned package that contributes one or more **extension points**:

| Extension point | Example |
| --- | --- |
| **Tendril** | A new specialist agent (e.g. `media-agent`, `devops-agent`) |
| **Tool** | A typed, schema-validated capability an agent can call |
| **Channel** | A new chat front-end (Slack, WhatsApp, Matrix, SMS) |
| **Model adapter** | A new provider (Gemini, Groq, Bedrock, a local server) |
| **Storage driver** | A new state/memory backend (Postgres, Redis, S3) |
| **Dashboard widget** | A new panel/visualization in the Astro UI |
| **Skill** | A grounding-aware skill manifest (`SKILL.md`-compatible) |

### 8.5.2 Plugin manifest
Every plugin ships an `openhawkins.plugin.json` (echoing the source repo's
`openclaw.plugin.json`) declaring:
- `id`, `version`, `author`, `license`, `description`;
- `contributes`: which extension points + entry modules;
- `capabilities`: the **declared permission set** it needs (`shell`, `network`,
  `filesystem:read`, `filesystem:write`, `send-message`, `model-call`, …);
- `config`: a JSON schema for its settings (secrets refused — env-only, per the
  source's secrets policy);
- `compat`: supported OpenHawkins version range.

### 8.5.3 Capability sandbox (the safety foundation — ties to P8)
Third-party code is **untrusted**. The runtime enforces:
- **Declared-capability gating.** A plugin can only use capabilities it declared;
  the runtime denies anything outside its grant at call time.
- **Install-time disclosure.** Before install, the user sees exactly what the
  plugin asks for — *"this plugin wants: shell, network, send-message"* — in the
  CLI and the dashboard. No silent escalation.
- **Approval gates for side-effects.** Network/shell/send-message calls from a
  plugin route through the same runtime-mediated approval gates as the
  `comm-agent` "send it?" flow.
- **Isolation.** Plugin tool handlers run with a constrained API surface (no
  ambient `process`/`fs` access — only the injected, capability-scoped host API).

### 8.5.4 Loading & distribution (v1)
- **Local dir** — drop a plugin folder in the OpenHawkins plugins path.
- **npm** — `openhawkins plugins install npm:<pkg>`.
- **Skill compatibility** — read the same `SKILL.md` format the Claude `skills`
  CLI uses (the format used to install `emil-design-eng`, `impeccable`,
  `design-taste-frontend` for this very project), so the existing skill ecosystem
  drops in.

### 8.5.5 The marketplace (future phase)
A hosted registry (the OpenHawkins analogue of npm / the source's "ClawHub"):
- **Submission flow:** author publishes → automated **manifest validation** +
  **security scan** (static capability audit, dependency check) → versioned,
  **signed** package.
- **Trust & safety:** signed packages; capability disclosure surfaced at install;
  a review/curation process; report/takedown path; semver + deprecation.
- **Discovery:** browse/search in the dashboard ("Marketplace" view) and via
  `openhawkins plugins search <query>`; ratings, install counts.
- **Optional monetization** (paid/private plugins) — left open, not v1.

The marketplace is **deferred to its own phase (M1, §9)**, but the **plugin SDK,
loader, and capability sandbox are v1** so that everything above is possible
without a breaking redesign later.

---

## 9. Decomposition & build order

Each subproject gets its own spec → plan → implementation cycle. This document is
the umbrella; do **not** try to implement it all from one plan.

| # | Subproject | Deliverable | Why this order |
| --- | --- | --- | --- |
| **S0** | **Repo + monorepo scaffold + this Plan** | Git repo, workspace skeleton, CI, this design doc | Foundation for everything (in progress) |
| **S1** | **Core runtime + Grounding engine** | Model adapters + agent loop + typed tool registry + Grounding, proven by a thin vertical slice (1 agent, 1 tool, grounding enforced) on Win/Mac/Linux | The foundation **and** the direct fix for the #1 pain point. Highest value, highest risk → first. |
| **S2** | **State + Memory (SQLite-default)** | VINES + VECNA reborn, runtime-owned, auto-injected | Orchestrator depends on these |
| **S3** | **Orchestrator + Tendrils** | The Nexus (Pulse in code) + 6 specialists, in-process dispatch | The pattern itself |
| **S4** | **Channels + Gateway** | Telegram + Discord + CLI + WS daemon | Makes it usable by humans |
| **S5** | **Dashboard** | Astro real-time motion-rich UI | Operator oversight (replaces Linear) |
| **S6** | **Plugin SDK + loader + capability sandbox** | `plugin-sdk` + `registry`: load local/npm plugins, declared-capability gating, install-time disclosure | Makes the platform extensible; **prerequisite for the marketplace** |
| **S7** | **Cross-platform packaging** | Single-binary builds + installers for 3 OSes | Ship it |
| **M1** *(future)* | **Hosted marketplace** | Registry, submission + security-scan + signing flow, dashboard "Marketplace" view | Community plugin ecosystem (needs S6 contracts stable first) |

> **Note:** the *plugin contract* (the `plugin-sdk` types) and the *capability
> sandbox* are designed in S1 alongside the tool registry, even though the full
> loader lands in S6 — so third-party safety isn't retrofitted onto an unsafe core.

**Recommended next step after this plan is approved:** spec **S1** in detail, then
implement a walking-skeleton vertical slice that demonstrates the Grounding engine
ending hallucination on a real task.

---

## 10. Extra ideas (brainstorm)

Captured for consideration; not committed to v1 scope.

- **MCP support** — OpenHawkins as both an MCP *client* (consume external tools)
  and an MCP *server* (expose Tendrils to other agents). Huge interop win.
- **Skill marketplace compatibility** — read the same `SKILL.md` format the
  `skills` CLI uses (the one we just used to install Emil/impeccable/Taste), so
  the community ecosystem drops in.
- **Cost & token budgets per orchestration**, enforced by the scheduler (hard cap
  → graceful stop), surfaced live in the dashboard.
- **Deterministic replay & eval harness** — record every turn; replay to debug or
  to A/B a prompt/model change; regression-test agent behavior.
- **Local-first / offline mode** — fully functional with Ollama, no cloud.
- **Plugin API** — let OpenHawkins itself be extended (new Tendrils, new channels,
  new tools) without forking.
- **"Pulse replay" as shareable artifacts** — export an orchestration as a
  self-contained, animated HTML trace.
- **Per-Tendril learning loop** — memory fragments tagged by tendril improve that
  specialist's future grounding (closes the loop on P11).

---

## 11. Open questions for review

1. **Binary toolchain** — Bun `--compile` (fast, single binary, some native-dep
   edge cases) vs Node SEA (official, heavier). Decide via a spike in S1. *Lean:
   Bun.*
2. **Model defaults** — which providers ship enabled out of the box? Anthropic
   (Opus 4.8 / Sonnet 4.6 / Haiku 4.5) for grounding-critical + Ollama for local?
3. **Schema lib** — Zod vs TypeBox (source uses TypeBox). *Lean: Zod for DX, or
   keep TypeBox for continuity.*
4. **Tendril set** — keep the exact 6 (system/code/research/data/comm/vision) or
   adjust for the new cross-platform reality?
5. **Linear** — drop entirely in favor of the dashboard, or keep as an optional
   exporter?
6. **License** — MIT (like the source) or other?

---

## 12. What this plan deliberately keeps from `openclaw-hawkins`

- The **Nexus + Tendrils** mental model and the **5-phase Pulse**.
- **VINES** (durable state) and **VECNA** (decay-aware memory) as concepts — but
  reborn as runtime-owned, SQLite-default, auto-driven subsystems.
- The **TypeScript + strict-typing + high-coverage** engineering culture.
- The **Stranger-Things-flavored vocabulary** is optional branding; the protocol
  is the substance.
