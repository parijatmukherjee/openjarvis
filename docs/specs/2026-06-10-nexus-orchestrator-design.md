# Nexus Orchestrator — Design Spec (S3)

> **Canonical vision:** [`docs/vision.md`](../vision.md) — read first.

**Date:** 2026-06-10  
**Status:** Design spec — approved for implementation  
**Author:** Parijat Mukherjee (with OpenCode)  
**Source:** [`CHECKPOINT.md`](../../CHECKPOINT.md) §5, [`docs/specs/2026-06-10-jarvis-hub-architecture.md`](2026-06-10-jarvis-hub-architecture.md)

---

## 1. One-paragraph thesis

**Nexus** is the multi-agent orchestration engine inside `@openjarvis/jarvis`. It receives parsed intents from the Hub, decides which specialist agents to dispatch (parallel for independent tasks, sequential for dependent ones), collects their results, synthesizes them into a coherent response, and emits every step as an auditable event. The public API is a simple promise — `nexus.execute(intent)` — but internally, every decision is event-sourced for replay, audit, and real-time observability.

Nexus does **not** handle voice, display, or session lifecycle — that's the Hub's job. Nexus is the brain; the Hub is the body.

---

## 2. Goals & non-goals

### Goals

1. **Multi-agent dispatch.** Route a single user intent to one or many specialist agents, running them in parallel or sequence as appropriate.
2. **Hybrid dispatch.** Parallel for independent tasks (weather + calendar), sequential for dependent tasks (search → summarize).
3. **Event-sourced observability.** Every routing decision, dispatch, completion, and synthesis emits an auditable event to the EventBus.
4. **Replayability.** Any conversation turn can be replayed by re-running the event sequence.
5. **Task Board integration.** Real-time task tracking via `task_started` / `task_completed` events.
6. **Agent capability discovery.** Agents declare capabilities; Nexus routes based on capability matching, not hardcoded IDs.
7. **Graceful degradation.** If an agent fails or times out, Nexus continues with partial results and informs the user.
8. **Operator observability.** WebSocket + CLI + Desktop dashboard showing active tasks, conversation history, and allowing manual override.

### Non-goals (for S3 / v1)

- **No actual voice model.** Whisper/Piper integration is J1.1 (Hub layer).
- **No actual display controller.** Electron/OS-native display is J1.1 (Hub layer).
- **No multi-user.** One Jarvis per household.
- **No cloud.** Everything is local.
- **No skill marketplace.** Agents are installed locally; marketplace is M1.
- **No persistent agent processes.** Agents are spawned per-request (v1); long-lived agent pools are v1.2.

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│              JARVIS HUB                 │
│  (Voice, Display, Session Lifecycle)    │
└──────────────┬──────────────────────────┘
               │
               ▼ intent + context
┌─────────────────────────────────────────┐
│           NEXUS ENGINE                  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │        1. Intent Router          │  │
│  │   Matches intent → agent(s)      │  │
│  │   Considers: confidence, priority, │  │
│  │   agent availability, dependencies │  │
│  └───────────────────────────────────┘  │
│                    │                      │
│        ┌───────────┼───────────┐         │
│        ▼           ▼           ▼         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Dispatch │ │Dispatch │ │Dispatch │     │
│  │Agent A  │ │Agent B  │ │Agent C  │     │
│  │(parallel)│ │(parallel)│ │(parallel)│  │
│  └────┬────┘ └────┬────┘ └────┬────┘     │
│       │           │           │          │
│       ▼           ▼           ▼          │
│  ┌───────────────────────────────┐        │
│  │    2. Result Collector       │        │
│  │   Merges all agent results   │        │
│  │   Handles: success, failure, │        │
│  │   partial, timeout           │        │
│  └───────────────┬───────────────┘        │
│                  │                        │
│                  ▼                        │
│  ┌───────────────────────────────┐        │
│  │    3. Synthesizer            │        │
│  │   Merges into single response│        │
│  │   spoken + visual + action    │        │
│  └───────────────┬───────────────┘        │
│                  │                        │
│                  ▼                        │
│  ┌───────────────────────────────┐        │
│  │    4. Event Emitter          │        │
│  │   Emits: intent_routed,      │        │
│  │   agent_dispatched,          │        │
│  │   agent_completed,           │        │
│  │   result_collected,          │        │
│  │   synthesis_complete         │        │
│  └───────────────────────────────┘        │
└─────────────────────────────────────────┘
```

**Key design principle:** Nexus is a **stateless engine**. All state lives in the event bus + the hub's session. Nexus receives an intent, runs the pipeline, returns a synthesis, and forgets everything. The Hub's session carries context across turns.

---

## 4. Core Components

### 4.1 NexusEngine

```typescript
export interface NexusConfig {
  intentRouter: IntentRouter;
  agentPool: AgentPool;
  synthesizer: Synthesizer;
  eventBus: EventBus;
  auditLog: AuditLog;
  memoryStore?: MemoryStore;
  maxConcurrentAgents: number; // default 5
  defaultTimeoutMs: number;    // default 30000
}

export class NexusEngine {
  constructor(private cfg: NexusConfig);
  
  /** Execute a parsed intent through the full pipeline */
  async execute(intent: Intent, context: JarvisContext): Promise<Synthesis>;
}
```

### 4.2 IntentRouter

```typescript
export interface IntentRouter {
  /** Given an intent, return the dispatch strategy */
  route(intent: Intent, context: JarvisContext): DispatchPlan;
}

export interface DispatchPlan {
  /** Agents to run in parallel (independent tasks) */
  parallel: AgentRoute[];
  /** Agents to run sequentially (dependent tasks; output of N-1 feeds into N) */
  sequential: AgentRoute[];
  /** Primary agent for single-agent intents */
  primary?: AgentRoute;
}

export interface AgentRoute {
  agentId: string;
  confidence: number;    // how sure the router is this agent fits
  timeoutMs?: number;     // override default timeout
  required: boolean;      // if true, failure aborts the whole turn
  input?: unknown;        // pre-computed input (for sequential chains)
}
```

**Default implementation:** Rule-based router with intent→agent mapping. Extensible via registry.

### 4.3 AgentPool

```typescript
export interface AgentPool {
  /** Get available agents */
  list(): Promise<AgentInfo[]>;
  /** Execute an agent */
  execute(route: AgentRoute, context: AgentContext): Promise<AgentResult>;
  /** Check if agent is healthy */
  health(agentId: string): Promise<boolean>;
}
```

**Process model:**
- Agents are loaded from `@openjarvis/agents` package
- Each agent runs in-process (v1), worker thread (v1.1), or child process (v1.2)
- The pool manages agent lifecycle (spawn, reuse, kill on timeout)

### 4.4 Synthesizer

```typescript
export interface Synthesizer {
  synthesize(
    results: AgentResult[],
    originalIntent: Intent,
    context: JarvisContext
  ): Promise<Synthesis>;
}
```

**Default:** Rule-based for structured results (calendar + weather → combined spoken + visual). For free-form, delegates to the LLM via `buildAgentRun`.

---

## 5. The Pulse Loop (5-Phase Conversation Management)

The Pulse is the **higher-level loop** that manages a multi-turn conversation between the user and Jarvis. It lives inside `JarvisHub`, not Nexus.

```
┌─────────────────────────────────────────┐
│           PULSE LOOP                    │
│   (runs once per conversation session)  │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ PHASE 1 │→│ PHASE 2 │→│ PHASE 3 │ │
│  │ AWAIT   │ │ PARSE   │ │ ROUTE   │ │
│  │ INPUT   │ │ INTENT  │ │ &       │ │
│  │         │ │         │ │ DISPATCH│ │
│  └─────────┘  └─────────┘  └────┬────┘ │
│                                 │       │
│  ┌─────────┐  ┌─────────┐    │       │
│  │ PHASE 5 │←│ PHASE 4 │←────┘       │
│  │ AWAIT   │ │ SYNTHESIZE│           │
│  │ FEEDBACK│ │ & OUTPUT  │            │
│  │         │ │           │            │
│  └─────────┘  └─────────┘            │
│       │                                │
│       ▼                                │
│  User responds → goes to PHASE 1       │
│  (or session ends)                     │
└─────────────────────────────────────────┘
```

**Phase details:**

| Phase | What happens | Emits events |
|-------|--------------|--------------|
| **1. Await Input** | Wake word detected → STT active → text captured | `wake_detected`, `transcription_complete` |
| **2. Parse Intent** | IntentParser analyzes text → produces Intent | `intent_parsed` |
| **3. Route & Dispatch** | Nexus routes intent → dispatches agents → collects results | `agent_dispatched`, `agent_completed`, `result_collected` |
| **4. Synthesize & Output** | Nexus synthesizes → TTS speaks → Display shows | `synthesis_complete`, `tts_spoken`, `display_command` |
| **5. Await Feedback** | Wait for user response or proactive trigger | `session_idle`, `session_resumed` |

**Pulse ≠ Hub lifecycle:**
- Hub lifecycle: IDLE → LISTENING → THINKING → RESPONDING → IDLE (per turn)
- Pulse: manages the **conversation arc** across multiple turns
- Pulse runs on top of the Hub, not replacing it

---

## 6. Event Model

Every Nexus step emits an event:

```typescript
type NexusEvent =
  // Routing
  | { type: "intent_routed"; intent: Intent; plan: DispatchPlan; sessionId: string; at: number }
  
  // Dispatch
  | { type: "agent_dispatched"; agentId: string; route: AgentRoute; sessionId: string; at: number }
  
  // Completion
  | { type: "agent_completed"; agentId: string; result: AgentResult; durationMs: number; sessionId: string; at: number }
  | { type: "agent_failed"; agentId: string; error: string; sessionId: string; at: number }
  | { type: "agent_timeout"; agentId: string; timeoutMs: number; sessionId: string; at: number }
  
  // Collection
  | { type: "results_collected"; results: AgentResult[]; failed: string[]; sessionId: string; at: number }
  
  // Synthesis
  | { type: "synthesis_complete"; synthesis: Synthesis; sessionId: string; at: number }
  
  // Task Board
  | { type: "task_started"; taskId: string; agentId: string; description: string; sessionId: string; at: number }
  | { type: "task_completed"; taskId: string; agentId: string; success: boolean; sessionId: string; at: number }
  
  // Session
  | { type: "pulse_phase_changed"; from: PulsePhase; to: PulsePhase; sessionId: string; at: number }
  | { type: "session_context_loaded"; memoryFragments: number; sessionId: string; at: number };
```

**Event sourcing:** Every event is appended to `EventStore` (SQLite) with a monotonic sequence number.

---

## 7. Sidecar Features

These are **not** part of Nexus core — they're **agent capabilities** and **sidecar features** that Nexus enables.

```
┌─────────────────────────────────────────┐
│           NEXUS ENGINE                  │
│  (Intent → Route → Dispatch → Synthesize)│
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ System  │ │ Vision  │ │ Browser │
│ Agent   │ │ Agent   │ │ Agent   │
│         │ │         │ │         │
│• OS apps│ │• Camera │ │• Chrome │
│• Sound │ │• Emotion │ │  Driver │
│• Mic   │ │• Count   │ │• Click  │
│        │ │• DOM     │ │• Scroll │
└─────────┘ └─────────┘ └─────────┘
    │          │          │
    └──────────┼──────────┘
               ▼
┌─────────────────────────────────────────┐
│         SIDECAR FEATURES                 │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │Task Board│  │ Event    │  │ Replay │ │
│  │(real-time│  │ Replay   │  │ Engine │ │
│  │ status)  │  │ (debug)  │  │        │ │
│  └──────────┘  └──────────┘  └────────┘ │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │ WebSocket│  │  CLI     │            │
│  │ Dashboard│  │ Operator │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

### 7.1 Task Board

Real-time view of active tasks. Subscribes to `task_started` / `task_completed` events.

```typescript
export interface TaskBoard {
  getActiveTasks(sessionId?: string): Promise<Task[]>;
  getTaskHistory(sessionId?: string, limit?: number): Promise<Task[]>;
}

export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}
```

### 7.2 Event Replay

Reconstruct any conversation by replaying events.

```typescript
export interface ReplayEngine {
  /** Replay a session's events in order */
  replay(sessionId: string): Promise<NexusEvent[]>;
  /** Replay from a specific event index */
  replayFrom(sessionId: string, fromIndex: number): Promise<NexusEvent[]>;
}
```

### 7.3 Browser Agent

Controls Chrome via DevTools Protocol or Playwright.

```typescript
export interface BrowserAgent {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  scroll(direction: "up" | "down", amount?: number): Promise<void>;
  selectText(selector: string): Promise<string>;
  getDom(): Promise<string>;
  screenshot(): Promise<Buffer>;
}
```

### 7.4 Vision Agent

Accesses camera, detects humans, understands emotion.

```typescript
export interface VisionAgent {
  detectHumans(): Promise<HumanDetection[]>;
  detectEmotion(): Promise<EmotionResult>;
  countHumans(): Promise<number>;
}

export interface HumanDetection {
  id: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface EmotionResult {
  primary: "happy" | "sad" | "angry" | "neutral" | "surprised";
  confidence: number;
}
```

### 7.5 System Agent

OS-level operations.

```typescript
export interface SystemAgent {
  openApp(app: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  listApps(): Promise<string[]>;
  getSystemInfo(): Promise<SystemInfo>;
}
```

---

## 8. Security Model

### 8.1 Agent Isolation

| Isolation Level   | Used For                                           | Mechanism                       |
| ----------------- | -------------------------------------------------- | ------------------------------- |
| **In-process**    | Low-risk agents (memory, calculator, clock)        | Same Node.js process            |
| **Worker thread** | Medium-risk agents (file read, web search)         | `worker_threads`                |
| **Child process** | High-risk agents (shell, file write, network send) | `child_process.spawn`           |
| **OS sandbox**    | Untrusted agents (community skills)                | `seccomp`, `landlock`, `pledge` |

### 8.2 Capability Revocation

```typescript
export interface CapabilityRevoker {
  revoke(agentId: string, capability: CapabilityName): Promise<void>;
  restore(agentId: string, capability: CapabilityName): Promise<void>;
  revokeAll(agentId: string): Promise<void>;
}
```

When revoked, the agent's `ToolRegistry` is updated to deny the capability.

---

## 9. Data Model

### 9.1 Nexus Event Log

Extends `DomainEvent` with Nexus-specific events. See §6.

### 9.2 Agent Registry (SQLite)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,        -- "research", "system", "code", "vision", "browser"
  capabilities TEXT NOT NULL, -- JSON array of CapabilityName
  config TEXT NOT NULL,      -- JSON of agent-specific config
  isolation_level TEXT NOT NULL DEFAULT "in-process",
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

- `NexusEngine.execute()` with mocked router, pool, synthesizer
- `IntentRouter.route()` for various intent patterns
- `AgentPool.execute()` with mock agents
- `Synthesizer.synthesize()` with structured + free-form results
- Event emission: every step produces the right event

### 10.2 Integration Tests

- End-to-end turn: intent → dispatch → collect → synthesize
- Parallel dispatch: multiple agents run simultaneously
- Sequential dispatch: output of agent N feeds into agent N+1
- Timeout handling: agent exceeds timeout, Nexus continues with partial results
- Failure handling: required agent fails, Nexus aborts turn

### 10.3 Functional Tests

- Real agent execution via `nexus.execute()` in a separate process
- Event replay: replay a session's events and verify identical synthesis
- Task Board: verify real-time updates via event subscription

---

## 11. Acceptance Criteria

- [ ] Nexus routes intent to correct agent(s)
- [ ] Parallel dispatch runs agents concurrently
- [ ] Sequential dispatch runs agents in order, feeding output forward
- [ ] Synthesizer merges multiple results into coherent response
- [ ] Every step emits correct event to EventBus
- [ ] Task Board shows real-time task status
- [ ] Event Replay reconstructs any conversation turn
- [ ] Agent timeout is handled gracefully
- [ ] Agent failure with `required: true` aborts turn
- [ ] Agent failure with `required: false` continues with partial results
- [ ] All code passes: build · lint · format:check · coverage ≥99% · unit · functional · Docker

---

## 12. Spec Self-Review

- **Placeholder scan:** No TBDs. All sections complete.
- **Internal consistency:** The Pulse loop phases map to Hub lifecycle states. Events cover every step.
- **Scope check:** This is a focused spec for S3 (Nexus orchestrator). It does not cover:
  - J1.1: Real voice/display integration
  - J2: Agent definitions and factory
  - J3: Skills marketplace
  - J4: Electron dashboard UI
- **Ambiguity check:** Parallel vs sequential dispatch is explicitly defined. Mock vs real implementations are clearly labeled with version targets.

---

_Next step: Write implementation plan for S3, then execute. See [`docs/plans/`](../plans/)._
