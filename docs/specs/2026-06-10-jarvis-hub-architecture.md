# Jarvis Hub Architecture — Design Spec (J1)

> **Canonical vision:** [`docs/vision.md`](../vision.md) — read first.

**Date:** 2026-06-10  
**Status:** Design spec — approved for implementation  
**Author:** Parijat Mukherjee (with OpenCode)  
**Source:** [`docs/reviews/2026-06-10-jarvis-architectural-review.md`](../reviews/2026-06-10-jarvis-architectural-review.md) §Critical Gap C1

---

## 1. One-paragraph thesis

`@openhawkins/jarvis` is the **hub orchestrator** — a long-running daemon that listens for user input (voice or text), parses intent, delegates to a pool of specialist agents, synthesizes results back into a coherent response (spoken + visual), and presents it on the attached monitor. Jarvis is the **only interface** the user ever talks to; every other entity in the system is a delegated agent. The hub itself is stateless per session — all durable state lives in `@openhawkins/state` (events, audit, skills registry) and `@openhawkins/memory` (VECNA context). The hub is designed to be pluggable: voice engines, display managers, and agent implementations are swappable without changing core orchestration logic.

---

## 2. Goals & non-goals

### Goals

1. **Single interface to the user.** User speaks to Jarvis; Jarvis delegates.
2. **Voice-first, visual-second.** Voice input is primary; monitor output is secondary but always synchronized.
3. **Dynamic agent pool.** Agents are loaded on demand from the skills registry, not hardcoded.
4. **Pluggable pipelines.** STT, TTS, wake-word, display, and even the intent parser are interfaces with multiple implementations.
5. **Proactive + reactive.** Jarvis can respond to user commands (reactive) and can initiate based on schedules/events (proactive).
6. **Context-aware.** Every interaction carries VECNA memory (user preferences, past conversations, learned behaviors).
7. **Observable.** Every delegation, every agent call, every display command is audit-logged.
8. **Secure.** Agent capabilities are default-deny; skills must declare permissions; the hub can revoke any agent at any time.

### Non-goals (for J1 / v1)

- **No actual voice model in v1.** Interfaces exist, but v1 ships with a `MockVoiceEngine` (keyboard input simulation) while Whisper/Ollama integration is J1.1.
- **No actual display controller in v1.** Interfaces exist, but v1 ships with a `MockDisplayManager` (console.log) while Electron/monitor integration is J1.1.
- **No cloud.** Everything is local; optional cloud bridges are post-v1.
- **No multi-user.** One Jarvis per household.
- **No mobile companion.** Phone app is post-v1.
- **No skill marketplace.** Skills are installed locally (npm packages in a directory); hosted marketplace is M1.

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│         JARVIS HUB (Mini PC)            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         User Input Layer          │  │
│  │  ┌─────────┐  ┌──────────────┐   │  │
│  │  │  Voice  │  │   Electron   │   │  │
│  │  │  Input  │  │   Dashboard  │   │  │
│  │  └────┬────┘  └──────┬───────┘   │  │
│  │       │              │            │  │
│  │  ┌────▼──────────────▼────────┐   │  │
│  │  │     WakeWordEngine          │   │  │
│  │  │     (detects wake word)     │   │  │
│  │  └────┬───────────────────────┘   │  │
│  │       │                           │  │
│  │  ┌────▼──────────────┐            │  │
│  │  │   SttEngine       │  (speech to text)│  │
│  │  │   (Whisper/Ollama)│            │  │
│  │  └────┬──────────────┘            │  │
│  └───────┼───────────────────────────┘  │
│          │                              │
│  ┌───────▼──────────────────────────┐   │
│  │       JARVIS ORCHESTRATOR         │   │
│  │                                   │   │
│  │  1. IntentParser — parse intent   │   │
│  │  2. ContextResolver — load memory │   │
│  │  3. Delegator — spawn agents      │   │
│  │  4. Synthesizer — merge results   │   │
│  │  5. Persona — apply Jarvis voice  │   │
│  │  6. Output — TTS + DisplayManager │   │
│  │                                   │   │
│  │  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ Scheduler │  │  EventBus    │  │   │
│  │  │ (cron)    │  │  (pub/sub)   │  │   │
│  │  └──────────┘  └──────────────┘  │   │
│  └───────┬──────────────────────────┘   │
│          │                              │
│  ┌───────▼──────────────────────────┐   │
│  │        AGENT POOL                 │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌────┐ │   │
│  │  │Research│ │System│ │Code │ │Vision│ │ ... │   │
│  │  └─────┘ └─────┘ └─────┘ └────┘ │   │
│  │                                   │   │
│  │  Each agent runs in its own      │   │
│  │  process with scoped capabilities │   │
│  └───────┬──────────────────────────┘   │
│          │                              │
│  ┌───────▼──────────────────────────┐   │
│  │         STATE & MEMORY            │   │
│  │  @openhawkins/state (SQLite)      │   │
│  │  @openhawkins/memory (VECNA)      │   │
│  │  @openhawkins/security (Vault)    │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │      Monitor Controller             │   │
│  │  ┌────────┐  ┌────────┐          │   │
│  │  │Display │  │Display │ ...      │   │
│  │  │   1    │  │   2    │          │   │
│  │  └────────┘  └────────┘          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 4. Core Components

### 4.1 IntentParser

```typescript
export interface IntentParser {
  parse(input: string, context: JarvisContext): Promise<Intent>;
}

export interface Intent {
  action: string; // e.g., "get_updates", "open_app", "search_web"
  params: Record<string, unknown>;
  confidence: number; // 0-1
  ambiguous: boolean; // true if parser is unsure
  suggestedClarification?: string; // e.g., "Did you mean your calendar or the news?"
}

export interface JarvisContext {
  sessionId: string;
  userId: string;
  recentIntents: Intent[];
  currentTime: Date;
  location?: string; // derived from IP or manual config
}
```

**Default implementation:** A lightweight local model (Ollama/llama3.1) with a structured-output schema (JSON mode). The prompt includes the user's input + recent context + available actions. If confidence < 0.7, Jarvis asks for clarification.

**v1 fallback:** Rule-based parser (regex/heuristics) that matches common patterns: "open X", "search for Y", "remind me to Z".

---

### 4.2 Delegator (AgentPool)

```typescript
export interface Delegator {
  delegate(intent: Intent, context: JarvisContext): Promise<AgentResult[]>;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  output: unknown;
  success: boolean;
  error?: string;
  auditEntry: AuditEntry;
}

export interface AgentPool {
  getAvailableAgents(): Promise<AgentInfo[]>;
  spawn(agentId: string, config: AgentConfig): Promise<AgentHandle>;
  kill(handle: AgentHandle): Promise<void>;
}

export interface AgentHandle {
  id: string;
  process: ChildProcess; // or in-process reference
  grant: AgentGrant;
}
```

**Agent discovery:** The pool reads the skills registry (`@openhawkins/skills`) and loads agents dynamically. Each skill declares which agent(s) it provides via its `SKILL.md` manifest.

**Process model:** By default, each agent runs in a **separate Node.js worker thread** (for CPU isolation) or **child process** (for memory isolation). High-risk agents (`shell`, `network`) run in child processes with capability revocation. Low-risk agents (`memory`, `calculator`) run in-process.

---

### 4.3 Synthesizer

```typescript
export interface Synthesizer {
  synthesize(
    results: AgentResult[],
    originalIntent: Intent,
    context: JarvisContext,
  ): Promise<Synthesis>;
}

export interface Synthesis {
  spoken: string; // What Jarvis says via TTS
  visual?: VisualCommand[]; // What Jarvis shows on monitor(s)
  action?: string; // e.g., "await_user_confirmation"
}

export type VisualCommand =
  | { type: "open_app"; app: string; monitor?: number }
  | { type: "open_url"; url: string; monitor?: number }
  | { type: "show_text"; text: string; monitor?: number }
  | { type: "highlight"; element: string; monitor?: number }
  | { type: "clear"; monitor?: number };
```

**Default implementation:** A local model (Ollama) with a prompt template:

```
You are Jarvis. You have received results from your specialist agents.
Summarize them for the user in a natural, conversational way.
Also suggest what to show on the monitor.

Results:
- Research Agent: {result}
- System Agent: {result}

Response format (JSON):
{ "spoken": "...", "visual": [{"type": "open_app", "app": "..."}] }
```

---

### 4.4 Persona

```typescript
export interface Persona {
  name: string; // "Jarvis"
  voice: VoiceProfile; // TTS voice characteristics
  greeting: string; // "Good morning, Parijat."
  farewell: string; // "As you wish."
  tone: "formal" | "casual" | "professional";
  injectIntoSystemPrompt(base: string): string;
}

export interface VoiceProfile {
  engine: string; // "local-piper", "elevenlabs", "system"
  model?: string; // e.g., "en_US-lessac-medium"
  speed: number; // 0.8-1.2
  pitch: number; // 0.8-1.2
}
```

**Default:** "Jarvis" persona with a calm, helpful tone. The system prompt includes:

- "You are Jarvis, a personal AI assistant."
- "You delegate to specialist agents; explain what you're doing."
- "You are concise but warm."

---

### 4.5 Voice Pipeline (Interfaces)

```typescript
export interface WakeWordEngine {
  start(callback: () => void): Promise<void>;
  stop(): Promise<void>;
}

export interface SttEngine {
  transcribe(audioStream: ReadableStream<Uint8Array>): Promise<string>;
}

export interface TtsEngine {
  synthesize(text: string): Promise<ReadableStream<Uint8Array>>;
}

export interface AudioInput {
  open(): Promise<ReadableStream<Uint8Array>>;
  close(): Promise<void>;
}

export interface AudioOutput {
  play(stream: ReadableStream<Uint8Array>): Promise<void>;
}
```

**v1 implementations:**

- `MockWakeWordEngine` — listens for keyboard shortcut (`Ctrl+J`) instead of voice
- `MockSttEngine` — reads from `readline` (keyboard input)
- `MockTtsEngine` — writes to `console.log` with `[Jarvis says]` prefix
- `MockAudioInput` / `MockAudioOutput` — no-op / console-based

**v1.1 implementations:**

- `WhisperSttEngine` — local Whisper-small model via `@openai/whisper` or ollama
- `PiperTtsEngine` — local Piper TTS (fast, small models)
- `PorcupineWakeWordEngine` — Picovoice Porcupine wake word (free tier)

---

### 4.6 DisplayManager (Monitor Controller)

```typescript
export interface DisplayManager {
  listDisplays(): Promise<DisplayInfo[]>;
  openApp(app: string, displayId?: string): Promise<void>;
  openUrl(url: string, displayId?: string): Promise<void>;
  showText(text: string, displayId?: string): Promise<void>;
  clear(displayId?: string): Promise<void>;
}

export interface DisplayInfo {
  id: string;
  name: string;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}
```

**Platform implementations:**

- **macOS:** `open` command + AppleScript for window placement
- **Linux:** `xdg-open` + `wmctrl` / `xrandr` for display detection
- **Windows:** `Start-Process` + PowerShell for display detection

**v1 implementation:** `MockDisplayManager` — logs to console: `[Display] open_app: Calendar on display-1`

---

### 4.7 Scheduler (Proactive)

```typescript
export interface Scheduler {
  schedule(job: ScheduledJob): Promise<string>; // returns jobId
  cancel(jobId: string): Promise<void>;
  list(): Promise<ScheduledJob[]>;
}

export interface ScheduledJob {
  id?: string;
  name: string;
  cron: string; // "0 9 * * 1-5" = 9am weekdays
  intent: Intent; // What to do when triggered
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}
```

**Implementation:** Uses `node-cron` or `bree` for cron scheduling. When a job fires, the scheduler creates a synthetic user session and invokes the orchestrator with the job's intent.

---

### 4.8 EventBus (Cross-Agent Communication)

```typescript
export interface EventBus {
  publish(event: BusEvent): Promise<void>;
  subscribe(topic: string, handler: (event: BusEvent) => void): Subscription;
}

export interface BusEvent {
  topic: string;
  payload: unknown;
  timestamp: number;
  source: string; // agentId or "jarvis"
}

export interface Subscription {
  unsubscribe(): void;
}
```

**Implementation:** In-memory pub/sub for v1. Durable event bus (backed by SQLite) for v1.1. Topics include:

- `agent.completed` — an agent finished its task
- `agent.failed` — an agent crashed or was killed
- `user.presence` — user entered/left the room (detected by camera/motion)
- `time.alarm` — scheduler fired
- `system.low_battery` — hub battery low (if running on UPS/laptop)

---

## 5. Jarvis Session Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  IDLE    │────▶│ LISTENING│────▶│ THINKING │────▶│ RESPONDING│
│          │     │          │     │          │     │           │
│ Waiting  │     │ Wake word│     │ Parse    │     │ TTS +     │
│ for wake │     │ detected │     │ Delegate │     │ Display   │
│ word     │     │ STT active│    │ Synthesize│    │           │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      ▲                                              │
      │                                              │
      └──────────────────────────────────────────────┘
                    (response complete → back to IDLE)
```

**State transitions are event-sourced.** Every transition emits a `JarvisStateChanged` event to the event store, enabling replay and debugging.

---

## 6. Security Model

### 6.1 Agent Isolation

| Isolation Level   | Used For                                           | Mechanism                       |
| ----------------- | -------------------------------------------------- | ------------------------------- |
| **In-process**    | Low-risk agents (memory, calculator, clock)        | Same Node.js process            |
| **Worker thread** | Medium-risk agents (file read, web search)         | `worker_threads`                |
| **Child process** | High-risk agents (shell, file write, network send) | `child_process.spawn`           |
| **OS sandbox**    | Untrusted agents (community skills)                | `seccomp`, `landlock`, `pledge` |

### 6.2 Capability Revocation

The hub can revoke capabilities at any time:

```typescript
export interface CapabilityRevoker {
  revoke(agentId: string, capability: CapabilityName): Promise<void>;
  restore(agentId: string, capability: CapabilityName): Promise<void>;
  revokeAll(agentId: string): Promise<void>;
}
```

When revoked, the agent's `ToolRegistry` is updated to deny the capability. If the agent attempts to use a revoked capability, it receives a `CapabilityRevokedError`.

### 6.3 Skill Sandbox

Every skill runs with a declared capability set. The skill loader reads the `SKILL.md` manifest and constructs an `AgentGrant` with only the declared capabilities. If the skill attempts to use a capability it didn't declare, the call is blocked and logged.

---

## 7. Data Model

### 7.1 Jarvis Event Log

Extends `DomainEvent` with Jarvis-specific events:

```typescript
type JarvisEvent =
  | { type: "WakeWordDetected"; sessionId: string; deviceId: string; at: number }
  | {
      type: "TranscriptionComplete";
      sessionId: string;
      text: string;
      confidence: number;
      at: number;
    }
  | { type: "IntentParsed"; sessionId: string; intent: Intent; at: number }
  | { type: "AgentDelegated"; sessionId: string; agentId: string; intent: Intent; at: number }
  | { type: "AgentCompleted"; sessionId: string; agentId: string; success: boolean; at: number }
  | { type: "SynthesisComplete"; sessionId: string; synthesis: Synthesis; at: number }
  | { type: "TtsSpoken"; sessionId: string; text: string; at: number }
  | { type: "DisplayCommand"; sessionId: string; command: VisualCommand; at: number }
  | { type: "JarvisStateChanged"; sessionId: string; from: string; to: string; at: number };
```

### 7.2 Skills Registry (SQLite)

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  path TEXT NOT NULL,        -- filesystem path to skill package
  manifest TEXT NOT NULL,    -- JSON of SKILL.md
  capabilities TEXT NOT NULL, -- JSON array of CapabilityName
  installed_at INTEGER NOT NULL,
  updated_at INTEGER,
  active BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,        -- "research", "system", "code", etc.
  config TEXT NOT NULL,      -- JSON of agent-specific config
  grant TEXT NOT NULL        -- JSON of AgentGrant
);
```

---

## 8. Backward Compatibility

The existing `openhawkins-run` CLI and `bin/ask.ts` remain unchanged. The Jarvis hub is a **new top-level entrypoint**: `packages/jarvis/src/bin/jarvis.ts`. It reuses all existing packages (`core`, `state`, `memory`, `security`) as libraries.

When upgrading from single-agent to Jarvis hub:

1. The existing SQLite database is reused (events, audit, memory)
2. The skills registry table is added via migration
3. The agents table is seeded with built-in agents (research, system, code, etc.)
4. The user runs `openhawkins jarvis` to start the hub

---

## 9. Acceptance Criteria

- [ ] Jarvis hub starts and listens for keyboard input (mock wake word)
- [ ] User types "open my calendar" → Jarvis parses intent → delegates to System Agent → opens calendar app (mock display)
- [ ] Jarvis speaks response via TTS (mock: console output)
- [ ] Every interaction is audit-logged with full chain
- [ ] Agents run in isolation (worker thread or child process)
- [ ] Capability revocation works mid-session
- [ ] Scheduler fires a job and Jarvis initiates a proactive interaction
- [ ] VECNA memory is injected into every Jarvis turn
- [ ] All code passes: build · lint · format:check · coverage ≥99% · unit · functional · Docker

---

## 10. Spec Self-Review

- **Placeholder scan:** No TBDs. All sections complete.
- **Internal consistency:** The `Delegator` returns `AgentResult[]` which the `Synthesizer` consumes — pipeline is clear. The `EventBus` topics match the lifecycle states.
- **Scope check:** This is a focused spec for J1 (hub architecture). It does not cover:
  - J1.1: Real voice model integration (Whisper, Piper)
  - J1.1: Real display controller (Electron, OS-native)
  - J2: Agent definitions and factory
  - J3: Skills marketplace and installer
  - J4: Electron dashboard UI
- **Ambiguity check:** "In-process" vs "worker thread" vs "child process" is explicitly defined by risk level. Mock vs real implementations are clearly labeled with version targets.

---

_Next step: Write implementation plan for J1, then execute. See [`docs/plans/2026-06-10-jarvis-hub-implementation.md`](../plans/2026-06-10-jarvis-hub-implementation.md)._
