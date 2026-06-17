# OpenJarvis — checkpoint

> At-a-glance status for anyone (AI agent or human) picking up this project. Read this
> first, then [`AGENT.md`](AGENT.md) for how to work here. Detailed, authoritative
> trackers live under `docs/` and are linked below.
>
> **Last updated:** 2026-06-17 · **Default branch:** `main` (protected; required
> `docker-gate`) · **Tests:** 764 passing / 1 skipped, **99.62% coverage** (gate floor 99%).
> **Zero-Flaw Campaign: 24/24 ✅**
> **S3 Nexus Orchestrator: MERGED ✅**
> **Desktop App (Electron): IN PROGRESS — Electron main-process wiring on branch `desktop-electron-main-wiring`**
> **Track B Multi-Device Sync: MERGED ✅**
> **Process Enforcement: MERGED ✅**

---

## 1. What this is

A self-owned AI-agent runtime with the Jarvis multi-agent orchestration pattern.
TypeScript monorepo, embedded SQLite, single self-contained binary, runs on Node and
Bun. Thesis: **the model proposes, the runtime enforces** (grounding, tool-calling,
state, capabilities). Full vision: [`docs/specs/2026-06-05-openjarvis-design.md`](docs/specs/2026-06-05-openjarvis-design.md).

## 2. Packages that exist today

| Package                   | Status | Role                                                                                                                                                                                                                   |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openjarvis/core`        | 🟢     | Agent loop, model adapters, tool registry (**the Lab**), **GroundingEngine** grounding, **Audit** audit, **the Vault** vault, **the Gate** taint/approval, redaction, structured logging, the Playbook process engine. |
| `@openjarvis/state`       | 🟢     | **JarvisStateStore**: durable SQLite (`SqlDriver` + migrations + event store + keyed audit store) and the durable composition root (`buildDurableAgentRun` + `openjarvis-run` CLI).                                    |
| `@openjarvis/memory`      | 🟢     | **JarvisMemoryStore**: decay-aware memory (fragments, recall, pure-JS embeddings + FTS5 fallback). **Wired into the agent path** via `buildAgentRun`/`buildDurableAgentRun`/`buildProbeAgent`.                         |
| `@openjarvis/markdownify` | 🟢     | Document → Markdown converters (CSV/HTML/JSON/XML/text) behind a never-throws `ConverterRegistry`. **Wired into the agent path** via `createDocumentTool` + `buildDurableAgentRun`/`buildProbeAgent`.                  |
| `@openjarvis/jarvis`      | 🟢     | Vision skill interfaces + E2E automation suite (`MockUser`, 15 scenarios). **S3 Nexus Orchestrator** (IntentRouter, AgentPool, Synthesizer, NexusEngine, TaskBoard, ReplayEngine) with 28 tests.                       |
| `@openjarvis/agents`      | 🟢     | Built-in agents package with `VisionAgent`/`MockVisionAgent` (agent delegator, pool interfaces).                                                                                                                       |
| `@openjarvis/desktop`     | 🟢     | Electron desktop app with Iron Man neon dashboard. Dashboard components wired to NexusContext. **Settings + user profile persisted to disk and exposed through typed IPC bridge.** **Real Electron main-process wiring on branch `desktop-electron-main-wiring`.** |
| `@openjarvis/track-b`     | 🟢     | Multi-device sync: device identity, CRDT sync, Noise protocol, task router, vault sync. 56 tests.                                                                                                                      |
| `@openjarvis/process`     | 🟢     | Process Enforcement: AGENT.md loop runtime enforcement with ProcessEngine, gate checks, lifecycle hooks, event bus. 57 tests.                                                                                          |

## 3. What's built and proven (done)

**S1 Foundation — the headline hallucination test passes.** Event-sourced session core
(durable `DomainEvent` log, single-writer serialized turns, reducer state, deterministic
replay); capability-gated never-throws `ToolRegistry` (default-deny + confused-deputy
guard); Ollama + OpenAI-compatible adapters over an injectable HTTP seam + a
`ScriptedAdapter`; the agent loop (native tool-calling with a model-call budget);
**GroundingEngine** grounding (`off`/`preferred`/`required`/`cited`); **Audit** hash-chained
audit; the Playbook process engine (phase manifest + machine + runner + `AgentRun`
integration); `ask`/`run` CLIs + eval harness. Specs: `docs/specs/2026-06-05-S1-*`,
`docs/specs/2026-06-09-agentrun-playbook-integration-design.md`.

**Production-readiness hardening (Track A, A1–A8 + follow-ups merged).** From the
[production-readiness review](docs/reviews/2026-06-09-production-readiness-review.md)
(§3 is the authoritative tracker). All landed behind the gate, each its own PR:

| Item        | Finding(s)       | What shipped                                                                                                                                                                                   | PR       |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1 + A1b    | F-C1, F-C2       | Durable `SqliteAuditLog` + injectable store/audit seam; runtime cutover (`buildDurableAgentRun` + `openjarvis-run`), proven cross-process. Durability + keyed audit now closed **at runtime**. | #18, #20 |
| A2          | F-C2             | Keyed HMAC-SHA256 audit chain under a Vault-held key; serialized appends.                                                                                                                      | #19      |
| A3          | F-C3             | Redaction on the event-store data plane + broadened provider/PII patterns; planted-secret e2e.                                                                                                 | #21      |
| A4          | F-C4, F-H1, F-M4 | Guarded JSON parse, request timeout + bounded retry/backoff, https-for-non-loopback baseURL.                                                                                                   | #22      |
| A5          | F-H2             | Single source of truth for `replans` (the event fold); `fold==state` invariant test.                                                                                                           | #23      |
| A6          | F-H5             | `FileVault`: atomic writes (temp+fsync+rename), serialized mutations, raised/tunable scrypt cost.                                                                                              | #24      |
| A7          | F-M1             | Structured `Logger`/`JsonLogger` (redacted, to stderr); emit at tool-registry + gate swallow points.                                                                                           | #25      |
| A8          | F-M2, F-M3       | CSV `reduce` fix, `maxInputChars` ceiling, XML depth cap; citation verifies exact field path, not whole payload.                                                                               | #28      |
| A2b + A7b   | —                | External audit anchoring (`anchorAuditChain`/`verifyAnchor`) + markdownify `ConverterRegistry` instrumented with logger sink.                                                                  | #29      |
| F-H6 wiring | F-H6             | `markdownify` + `JarvisMemoryStore memory` wired into `buildAgentRun`, `buildDurableAgentRun`, and `buildProbeAgent` — both now active in the live agent path.                                 | #29      |

**Track A is now COMPLETE.** All 24 Zero-Flaw items closed.

**Track B is now COMPLETE (PR #37, merged).** Multi-device sync with:

- Device identity + registry with Ed25519 keypairs (`tweetnacl`)
- Pairing flow with QR tokens
- Vector clock CRDT foundation
- Event log sync with delta sync
- Memory fragment CRDT with conflict resolution
- Device discovery over LAN
- Noise protocol handshake (mock XOR cipher)
- Cross-device task router with capability-aware scheduling
- Vault sync with HKDF-like key derivation
- Package: `@openjarvis/track-b` with 13 test files, 56 tests

**Process Enforcement is now COMPLETE (PR #38, merged).** Runtime-enforced AGENT.md loop:

- Phase manifest with 6 phases and DAG dependencies
- `ProcessEngine` with state tracking and dependency enforcement
- Per-phase gate checks (build/lint/format/test/coverage)
- Lifecycle hooks (pre-phase, post-phase, on-failure, on-complete)
- Event bus with replay support
- CLI with injectable factory for testability
- Package: `@openjarvis/process` with 9 test files, 57 tests

## 4. In flight

**PR #41 — Desktop Electron Main-Process Wiring** (`desktop-electron-main-wiring` branch)

- Real `electron-main.ts` entry point: BrowserWindow creation, frameless chrome, dev/prod renderer loading
- `DesktopStore` instantiation and IPC handler registration in `bootstrap()`
- Electron lifecycle: single-instance lock, window-all-closed, activate (macOS), closed handler
- Dev detection via `app.isPackaged` + `OPENJARVIS_DEV` env var
- Unhandled promise rejection catching on `bootstrap()` and `handleActivate`
- 13 unit tests with full Electron API mocking
- Renderer HTML updated with `<div id="root">` React mount point
- Package scripts: `dev`, `start`, `build:renderer`, `pack`
- `tailwindcss@3` + `autoprefixer` added as dev deps
- **Status:** All gates pass — ready for PR

## 5. What's next

1. **Merge PR #41** for Electron main-process wiring
2. **Real audio analysis (Web Audio API)** for `VoiceWaveform`
3. **Plugin SDK / registry**
4. **Gateway (network API)**
5. **CLI binary packaging**

## 6. How to work here

Follow [`AGENT.md`](AGENT.md): Research → Plan → Tasks → Execute (TDD) → Validate (the gate)
→ Present (PR). `main` is protected — land via a PR whose required `docker-gate` passes
(build · lint · format:check · coverage ≥99% · unit · functional). Conventional commits, one
logical change per commit.

## 7. Authoritative trackers (don't duplicate — update these)

- **Remediation status:** `docs/reviews/2026-06-09-production-readiness-review.md` §3 — the
  per-item source of truth for Track A / Track B. Keep its ✅ marks honest.
- **Design specs:** `docs/specs/` · **Implementation plans:** `docs/plans/` · **ADRs:**
  `docs/adr/` · **Security model:** `docs/security-model.md`.
