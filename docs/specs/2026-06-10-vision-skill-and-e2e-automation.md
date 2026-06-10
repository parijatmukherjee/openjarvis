# Vision Skill + E2E Automation — Design Spec

> **Canonical vision:** [`docs/vision.md`](../vision.md) — read first.  
> **Related specs:** [`docs/specs/2026-06-10-jarvis-hub-architecture.md`](./2026-06-10-jarvis-hub-architecture.md)

**Date:** 2026-06-10  
**Status:** Design spec — approved for implementation  
**Author:** Parijat Mukherjee (with OpenCode)  
**Scope:** Vision skill (camera, human/object detection, proactive awareness) + E2E automation suite (simulate real user journeys, assert all features work)

---

## 1. One-Paragraph Thesis

The **vision skill** extends Jarvis with real-time camera input, human/object detection, and proactive presence awareness. It operates as a hybrid pipeline: a low-framerate background poller for presence state and an on-demand high-framerate burst for explicit queries. The **E2E automation suite** simulates a complete user interacting with Jarvis — speaking commands, receiving spoken responses, and seeing visuals on screen — using in-process orchestration with all hardware mocked. Every feature (voice, vision, agents, display, proactive alerts) is exercised end-to-end.

---

## 2. Goals & Non-Goals

### Goals

1. **Real-time camera capture** — continuous frame polling at configurable FPS.
2. **Human & object detection** — detect `person`, `face`, `object` categories with bounding boxes and confidence scores.
3. **Proactive presence awareness** — publish `presence_change` events to the event bus; Jarvis can greet you when you walk in.
4. **Explicit vision queries** — "what do you see?", "count people", "is anyone there?" trigger high-framerate burst analysis.
5. **Resource-efficient throttling** — idle mode (0.5 fps) when no state change; burst mode (10 fps) on demand.
6. **E2E test coverage of all features** — voice input, wake word, intent parsing, agent delegation, vision detection, display commands, event bus, audit trail.
7. **Auto-display intelligence** — Jarvis automatically opens the right app/website on screen whenever it speaks about something with a visual counterpart.
8. **CI-friendly** — all E2E tests run headless with mocks; no real camera, mic, or display required.

### Non-Goals (for v1)

- **No real ML model in v1.** Interfaces exist; v1 ships with a `MockDetectionModel` that returns fixture-based results.
- **No actual camera hardware in v1.** `MockVisionEngine` uses pre-recorded frame fixtures (PNG buffers + metadata).
- **No facial recognition** — detect "a person" but not "Parijat".
- **No multi-camera** — single camera input only.
- **No video recording/storage** — frames are analyzed and discarded; only events are persisted.
- **No cloud vision APIs** — all detection is local (or mocked).
- **No real Electron/monitor in E2E** — `MockDisplayManager` logs commands for assertion.

---

## 3. Vision Skill Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────┐
│         VISION SKILL SUBSYSTEM            │
│                                         │
│  ┌─────────────┐   ┌─────────────────┐ │
│  │ VisionEngine │   │ DetectionModel  │ │
│  │ (capture)    │──▶│ (inference)     │ │
│  └─────────────┘   └────────┬────────┘ │
│                             │          │
│  ┌──────────────────────────▼────────┐│
│  │      PresenceStateMachine          ││
│  │  (idle → detecting → present →   ││
│  │   away → back → present)         ││
│  └────────────────┬──────────────────┘│
│                   │                     │
│  ┌────────────────▼──────────────────┐│
│  │  publish(VisionEvent → EventBus) ││
│  └──────────────────────────────────┘│
└───────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         JARVIS ORCHESTRATOR             │
│  · IntentParser now handles vision:     │
│    "what do you see?", "count people" │
│  · ContextResolver loads presence state │
│  · Delegator routes to VisionAgent    │
│  · Synthesizer auto-resolves visuals   │
└─────────────────────────────────────────┘
```

### 3.2 New Interfaces

**`packages/jarvis/src/vision/engine.ts`**

```typescript
export interface VisionEngine {
  start(config: VisionConfig): Promise<void>;
  stop(): Promise<void>;
  captureBurst(options: BurstOptions): Promise<VisionFrame[]>;
  getPresenceState(): PresenceState;
}

export interface VisionConfig {
  pollFps: number; // default: 2
  idleFps: number; // default: 0.5
  idleTimeoutMs: number; // default: 300000 (5 min)
  burstFps: number; // default: 10
  burstDurationMs: number; // default: 3000 (3 sec)
  detectionConfidence: number; // default: 0.6
}

export interface BurstOptions {
  durationMs: number;
  fps: number;
  reason: string; // e.g. "user_query", "security_alert"
}

export interface VisionFrame {
  frameId: string;
  timestamp: number;
  width: number;
  height: number;
  objects: DetectedObject[];
}

export interface DetectedObject {
  label: string; // e.g. "person", "chair", "cup"
  confidence: number; // 0–1
  bbox: { x: number; y: number; width: number; height: number };
}

export type PresenceState = "unknown" | "present" | "away" | "multiple_people";
```

**`packages/jarvis/src/vision/events.ts`**

```typescript
import type { BusEvent } from "../event-bus.js";

export interface VisionEvent extends BusEvent {
  topic: "vision";
  type: VisionEventType;
  payload: {
    frameId: string;
    objects: DetectedObject[];
    presenceState: PresenceState;
    confidence: number;
  };
}

export type VisionEventType =
  | "frame" // periodic frame analysis result
  | "presence_change" // human entered/left
  | "object_entered" // new object appeared
  | "object_exited" // object disappeared
  | "alert"; // security/privacy alert
```

**`packages/jarvis/src/vision/detection.ts`**

```typescript
export interface DetectionModel {
  analyze(frame: Uint8Array): Promise<DetectedObject[]>;
  warmup(): Promise<void>;
  dispose(): Promise<void>;
}
```

**`packages/jarvis/src/vision/presence.ts`**

```typescript
export interface PresenceStateMachine {
  getState(): PresenceState;
  onTransition(handler: (oldState: PresenceState, newState: PresenceState) => void): void;
}
```

### 3.3 Frame Lifecycle

```
┌────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Start    │────▶│ Poll Frame  │────▶│  Analyze    │────▶│  Publish    │
│  (config)  │     │  (capture)  │     │  (detect)   │     │  (event)    │
└────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                  │
                                                                  ▼
┌────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Throttle  │◀────│  Compare    │◀────│ State Machine│◀────│ Presence?   │
│  (idle?)   │     │  (delta?)   │     │  (update)    │     │  (change?)  │
└────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Start**: `VisionEngine.start(config)` initializes the camera and detection model.
2. **Poll Frame**: Capture a frame at `config.pollFps`.
3. **Analyze**: `DetectionModel.analyze(frame)` returns `DetectedObject[]`.
4. **Publish**: If objects changed or presence state changed, emit `VisionEvent` to `EventBus`.
5. **State Machine**: `PresenceStateMachine` tracks transitions (unknown → present → away → present).
6. **Compare**: If no state change for `config.idleTimeoutMs`, throttle to `config.idleFps`.
7. **Throttle**: Reduce polling frequency; ramp back up on any state change.

### 3.4 Vision Intent Expansion

The existing `Intent` interface in `packages/jarvis/src/intent.ts` gains new `action` values:

```typescript
// Vision-specific intents
| "vision_query"      // "what do you see?"
| "vision_count"      // "how many people are there?"
| "vision_presence"   // "is anyone there?"
| "vision_alert"      // triggered by presence_change event (proactive)
```

### 3.5 Vision Agent

**`packages/agents/src/built-in/vision.ts`**

```typescript
import type { AgentResult } from "@openjarvis/jarvis";

export interface VisionAgent {
  execute(intent: VisionIntent, context: JarvisContext): Promise<VisionAgentResult>;
}

export interface VisionAgentResult extends AgentResult {
  output: {
    summary: string; // "I see 1 person and a coffee mug"
    objects: DetectedObject[];
    presence: PresenceState;
  };
}
```

**Agent behavior by intent:**

| Intent            | Behavior                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `vision_query`    | Trigger burst capture, synthesize human-readable description     |
| `vision_count`    | Trigger burst, count objects by label, return count + summary    |
| `vision_presence` | Read current `PresenceState`, no burst needed                    |
| `vision_alert`    | Proactive — triggered by `presence_change` event, not user query |

---

## 4. Auto-Display Intelligence

### 4.1 Problem

When Jarvis says "You have 3 meetings today," the user shouldn't have to also say "show me my calendar." Jarvis should **automatically** open the calendar app on the primary monitor.

### 4.2 Solution: VisualResolver

The `Synthesizer` delegates visual command generation to a `VisualResolver`:

```typescript
interface VisualResolver {
  resolve(intent: Intent, agentResults: AgentResult[], context: JarvisContext): VisualCommand[];
}

interface VisualResolverConfig {
  mappings: Record<string, VisualCommand>; // intent.action → default visual command
  defaultMonitor: number;
  enabled: boolean; // user can disable auto-display globally
}
```

**Default mappings (configurable by user):**

| Intent Action   | Default Visual Command                        |
| --------------- | --------------------------------------------- |
| `get_weather`   | `open_url` → `https://weather.com/{location}` |
| `get_calendar`  | `open_app` → `calendar`                       |
| `get_email`     | `open_app` → `email_client`                   |
| `vision_query`  | `open_vision_feed`                            |
| `system_status` | `open_url` → `/dashboard/system`              |

Users can override any mapping via the Electron dashboard or a config file.

### 4.3 Auto-Display Mapping

| Intent             | Spoken Content                    | Auto-Visual Command                              |
| ------------------ | --------------------------------- | ------------------------------------------------ |
| `get_weather`      | "It's 72°F and sunny..."          | `open_url` → `https://weather.com/San_Francisco` |
| `get_calendar`     | "You have 3 meetings..."          | `open_app` → `calendar`                          |
| `get_email`        | "You have 5 unread emails..."     | `open_app` → `email_client`                      |
| `vision_query`     | "I see a person and a coffee mug" | `open_vision_feed` → live camera view            |
| `research_product` | "Best keyboards under $150..."    | `open_url` → research results page               |
| `system_status`    | "CPU at 45%, memory at 60%..."    | `open_url` → system dashboard                    |
| `get_news`         | "Top stories: AI regulation..."   | `open_url` → news aggregator                     |

### 4.4 VisualCommand Expansion

Existing `VisualCommand` in `packages/jarvis/src/synthesis.ts` gains new types:

```typescript
export type VisualCommand =
  | { type: "open_app"; app: string; monitor?: number }
  | { type: "open_url"; url: string; monitor?: number }
  | { type: "show_text"; text: string; monitor?: number }
  | { type: "highlight"; element: string; monitor?: number }
  | { type: "clear"; monitor?: number }
  // NEW: auto-display types
  | { type: "open_vision_feed"; monitor?: number }
  | { type: "show_agent_output"; agentId: string; monitor?: number }
  | { type: "show_context_card"; title: string; body: string; monitor?: number };
```

### 4.5 Display Selection Logic

```typescript
function selectMonitor(intent: Intent, context: JarvisContext, displays: DisplayInfo[]): number {
  // 1. If user explicitly specified monitor (e.g. "on monitor 2"), use that
  if (intent.params.monitor) return intent.params.monitor as number;

  // 2. If primary monitor is free, use it
  const primary = displays.find((d) => d.primary);
  if (primary) return 1; // monitor IDs are 1-indexed

  // 3. If primary is occupied, use secondary
  const secondary = displays.find((d) => !d.primary);
  if (secondary) return 2;

  // 4. Fallback: primary
  return 1;
}
```

---

## 5. E2E Automation Architecture

### 5.1 Goal

Create an E2E suite that **does exactly what a user would do** with Jarvis and asserts that all features work correctly. The suite runs in CI with all hardware mocked.

### 5.2 Architecture

```
┌─────────────────────────────────────────┐
│           E2E Test Runner               │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   MockUser (test helper)         │  │
│  │   · wake() → triggers wake word  │  │
│  │   · say(text) → feeds STT        │  │
│  │   · listen() → reads TTS output  │  │
│  │   · look() → reads Display log     │  │
│  │   · seeVision() → Vision events    │  │
│  │   · getEvents() → EventBus log     │  │
│  │   · getAudit() → Audit trail       │  │
│  └────────────────┬─────────────────┘  │
│                   │                     │
│  ┌────────────────▼─────────────────┐  │
│  │   Jarvis Hub (in-process)        │  │
│  │   · MockWakeWordEngine           │  │
│  │   · MockSttEngine (text in)      │  │
│  │   · MockTtsEngine (text out)     │  │
│  │   · MockDisplayManager (log)       │  │
│  │   · MockVisionEngine (fixtures)    │  │
│  │   · Orchestrator (real)          │  │
│  │   · Agent Pool (real)            │  │
│  │   · EventBus (real)              │  │
│  └────────────────┬─────────────────┘  │
│                   │                     │
│  ┌────────────────▼─────────────────┐  │
│  │   Assertions                     │  │
│  │   · intent.action === expected   │  │
│  │   · synthesis.spoken matches     │  │
│  │   · display.commands contain     │  │
│  │   · vision.events are correct    │  │
│  │   · agent results are correct    │  │
│  │   · event bus has events         │  │
│  │   · audit trail is complete      │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 5.3 MockUser API

**`packages/jarvis/test/e2e/mock-user.ts`**

```typescript
export class MockUser {
  constructor(private hub: JarvisHub);

  /** Simulate wake word detection */
  wake(): Promise<void>;

  /** Simulate user speaking */
  say(text: string): Promise<void>;

  /** Read last TTS output */
  listen(): string;

  /** Read all display commands */
  seeScreen(): VisualCommand[];

  /** Read all vision events */
  seeVision(): VisionEvent[];

  /** Read all event bus events */
  getEvents(): BusEvent[];

  /** Read audit trail */
  getAudit(): AuditEntry[];

  /** Assert Jarvis spoke expected text */
  assertHeard(expected: string | RegExp): void;

  /** Assert display showed expected command */
  assertSaw(command: Partial<VisualCommand>): void;

  /** Assert vision event occurred */
  assertVision(eventType: VisionEventType): void;
}
```

### 5.4 Test Scenarios (Must Cover All Features)

| #   | Scenario               | User Action                                                                  | Expected Behavior                                                                  |
| --- | ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Voice command**      | `user.say("what time is it?")`                                               | Intent: `get_time`, Synthesis: "It's 3:45 PM"                                      |
| 2   | **Wake word**          | `user.wake(); user.say("open calendar")`                                     | WakeWordEngine fires, STT transcribes, Display: open calendar app                  |
| 3   | **Clarification**      | `user.say("set a reminder")`                                                 | Intent ambiguous, Synthesis asks "For what time?"                                  |
| 4   | **Agent delegation**   | `user.say("find me a keyboard under $150")`                                  | Delegates to ResearchAgent, Synthesis merges results                               |
| 5   | **Vision query**       | `user.say("what do you see?")`                                               | VisionAgent runs burst, Synthesis: "I see a person and a coffee mug"               |
| 6   | **Vision alert**       | VisionEvent: `presence_change` (away→present)                                | Proactive: "Welcome back. You have 2 new messages."                                |
| 7   | **Multi-agent**        | `user.say("give me my daily briefing")`                                      | System + Comm + Research agents in parallel                                        |
| 8   | **Auto-display**       | `user.say("what's the weather?")`                                            | Synthesis: "72°F and sunny", Display: `open_url` → weather.com                     |
| 9   | **Multi-monitor**      | `user.say("show calendar on monitor 2")`                                     | Display: `open_app` calendar on monitor 2                                          |
| 10  | **Error handling**     | `user.say("do something impossible")`                                        | Agent fails gracefully, Synthesis explains                                         |
| 11  | **Event audit**        | Any command                                                                  | EventBus has `intent_parsed`, `agent_started`, `agent_completed`, `synthesis_done` |
| 12  | **Context memory**     | `user.say("remind me I like dark mode")` → later `user.say("open settings")` | MemoryAgent persists preference; SettingsAgent opens dark mode                     |
| 13  | **Proactive schedule** | Scheduler fires at 9:00 AM                                                   | Jarvis speaks: "Good morning. Your standup is in 30 minutes."                      |
| 14  | **Vision count**       | `user.say("how many people are in the room?")`                               | VisionAgent counts `person` objects, Synthesis: "I see 2 people."                  |
| 15  | **Vision presence**    | `user.say("is anyone there?")`                                               | Reads current `PresenceState`, Synthesis: "Yes, I see 1 person."                   |

---

## 6. Integration Points

### 6.1 Package Dependencies

```
@openjarvis/jarvis
  ├── @openjarvis/core       (AgentResult, AuditEntry, CapabilityName)
  ├── @openjarvis/state      (sessions, skills registry)
  ├── @openjarvis/memory     (JarvisMemoryStore context, preferences)
  ├── @openjarvis/agents     (VisionAgent, ResearchAgent, etc.)
  ├── @openjarvis/skills     (skill manifest, loader, sandbox)
  └── @openjarvis/security   (Vault, audit, capabilities)

@openjarvis/agents
  └── @openjarvis/jarvis     (Intent, JarvisContext, AgentResult)

@openjarvis/skills
  └── @openjarvis/jarvis     (VisualCommand, CapabilityName)
```

### 6.2 State Schema Migration

The `@openjarvis/state` package needs new tables for vision:

```sql
-- vision_events table
CREATE TABLE vision_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  presence_state TEXT NOT NULL,
  object_count INTEGER NOT NULL,
  objects_json TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- presence_log table (time-series)
CREATE TABLE presence_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  state TEXT NOT NULL,
  confidence REAL NOT NULL
);
```

### 6.3 Event Bus Topics

New topics published by the vision skill:

| Topic             | Publishers           | Subscribers               | Payload           |
| ----------------- | -------------------- | ------------------------- | ----------------- |
| `vision`          | VisionEngine         | Orchestrator, AuditLogger | `VisionEvent`     |
| `vision.presence` | PresenceStateMachine | Orchestrator              | `presence_change` |
| `vision.alert`    | VisionEngine         | Orchestrator, Security    | security alerts   |

---

## 7. Error Handling

### 7.1 Vision-Specific Errors

| Error                    | Recovery                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| Camera not available     | Log warning, set `PresenceState = "unknown"`, continue without vision |
| Detection model fails    | Retry once, then fall back to `MockDetectionModel` with fixture data  |
| Frame capture timeout    | Skip frame, emit `vision.alert` with type `capture_timeout`           |
| High CPU usage           | Auto-throttle: reduce `pollFps` by half until CPU < 80%               |
| Vision permission denied | Emit `vision.alert` with type `permission_denied`, log audit entry    |

### 7.2 E2E-Specific Errors

| Error             | Recovery                                                              |
| ----------------- | --------------------------------------------------------------------- |
| Test timeout      | Fail fast, capture full event bus log and audit trail for debugging   |
| Assertion failure | Print `MockUser` state dump: `listen()`, `seeScreen()`, `getEvents()` |
| Hub crash         | Restart per-test, ensure isolation                                    |

---

## 8. Testing Strategy

### 8.1 Test Pyramid

```
        ┌─────────┐
        │  E2E    │  15 scenarios, full user journey
        │  (slow) │  ~30 sec each
        └────┬────┘
             │
        ┌────┴────┐
        │Integration│  Component combos: voice+intent, vision+eventbus
        │ (medium) │  ~5 sec each
        └────┬────┘
             │
        ┌────┴────┐
        │  Unit   │  Individual classes: VisionEngine, DetectionModel,
        │ (fast)  │  PresenceStateMachine, VisualResolver, MockUser
        └─────────┘  ~50ms each
```

### 8.2 Coverage Requirements

- **Unit tests:** ≥99% coverage for all new files in `packages/jarvis/src/vision/`
- **Integration tests:** ≥90% coverage for `VisionEngine` + `EventBus` interaction
- **E2E tests:** 100% of the 15 scenarios must pass; each scenario is a separate test file

### 8.3 CI Integration

```yaml
# .github/workflows/e2e.yml (conceptual)
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npm run build
    - run: npm run test:e2e
      env:
        JARVIS_E2E_HEADLESS: true
        JARVIS_E2E_TIMEOUT: 30000
```

---

## 9. Performance Considerations

### 9.1 Vision Pipeline

| Mode   | FPS | CPU Target | Use Case                            |
| ------ | --- | ---------- | ----------------------------------- |
| Idle   | 0.5 | <5%        | No state change for 5 min           |
| Normal | 2   | <15%       | Default presence monitoring         |
| Burst  | 10  | <40%       | User explicit query                 |
| Alert  | 5   | <20%       | Security mode after presence change |

### 9.2 Memory Budget

- Frame buffer: 30 frames × 640×480 × 3 bytes ≈ **27 MB**
- Detection model (mock): **negligible**
- Event store (SQLite): **pruned to 7 days**

---

## 10. Security & Privacy

### 10.1 Camera Permission Model

- Camera access requires explicit user approval (stored in `Vault`)
- Vision events are audit-logged with `deviceId` and `sessionId`
- No frames are persisted to disk — only detection results
- `MockVisionEngine` in tests uses fixture images, never real camera

### 10.2 Presence Data

- Presence state is **not** synced across devices (local-only)
- Presence log is retained for **7 days** then auto-pruned
- User can disable vision skill entirely via `JarvisConfig`

---

## 11. Non-Goals (Reiterated)

- No real ML model in v1 (mock only)
- No actual camera hardware in v1 (fixtures only)
- No facial recognition (detect "person", not identity)
- No multi-camera support
- No video recording or storage
- No cloud vision APIs
- No real Electron/monitor in E2E (mock display manager)
- No mobile companion app

---

## 12. Canonical References

- **Main design spec:** [`docs/specs/2026-06-10-jarvis-hub-architecture.md`](./2026-06-10-jarvis-hub-architecture.md)
- **Implementation plan:** [`docs/plans/2026-06-10-jarvis-hub-implementation.md`](../plans/2026-06-10-jarvis-hub-implementation.md)
- **Vision document:** [`docs/vision.md`](../vision.md)
- **Security model:** [`docs/security-model.md`](../security-model.md)

---

_This document is the single source of truth for the vision skill and E2E automation. All code, design, and implementation must align with it._
