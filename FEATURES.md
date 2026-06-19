# OpenJarvis — Feature List

> Comprehensive list of all features implemented across the project.
> Last updated: 2026-06-19

---

## Core Runtime (`@openjarvis/core`)

### Agent Loop & Model Adapters

1. Event-sourced session core — durable `DomainEvent` log, single-writer serialized turns, reducer-based state, deterministic replay
2. Agent loop — native tool-calling round-trip with model-call budget
3. Ollama model adapter — local + cloud, one code path
4. OpenAI-compatible model adapter — injectable HTTP seam
5. Scripted model adapter — deterministic replay for testing
6. `HttpModelClient` — injectable HTTP seam for model requests

### The Lab — Capability-Gated Tool Registry

7. Default-deny `ToolRegistry` — tools must be explicitly registered
8. Never-throws tool execution — all tool errors caught and returned as `ToolResult`
9. Confused-deputy guard — capability grants checked before tool invocation
10. Zod validation — both input (args) and output validated against schemas
11. Approval gate — `approvalRequired` flag on `ToolDefinition` for high-risk tools
12. `document:convert` tool — Markdown conversion of documents
13. `disk_free` tool — disk space and platform info

### GroundingEngine

14. Four grounding modes: `off`, `preferred`, `required`, `cited`
15. `required` mode — rejects answers before a successful qualifying tool call
16. `cited` mode — verifies citations and numeric claims against tool results

### Security

17. The Vault — encrypted `FileVault` with crash-safe atomic writes
18. The Gate — taint levels, provenance tracking, `approvalRequired` on high-risk tools
19. Secret redaction — redacts secret-shaped values from events, audit, and prompts
20. Capability system — `CapabilityName` type-safe grants, `grantSatisfies` checker
21. Audit — keyed HMAC hash chain (tamper-evident), durable in SQLite, verified across restarts

### Observability & Utilities

22. Structured, redacted logging (`JsonLogger`)
23. Metrics — observability counters
24. Rate limiter — token bucket with cleanup
25. Clock abstraction, ID generation, OS platform detection

### Playbook Process Engine

26. ProcessEngine — phase-based execution with dependency gates
27. Gate checks — process gate validation
28. Lifecycle hooks — pre/post hooks for process stages
29. ProcessEvents — event bus for process events
30. ProcessManifest — process definition schema

### Memory

31. `MemoryStore` interface — core adapter for memory recall
32. Session & replay — `InMemoryEventStore`, `SqliteEventStore`, `rebuildStateStreaming`

---

## Durable State (`@openjarvis/state`)

33. `SqlDriver` — SQLite driver abstraction (`node:sqlite` / `bun:sqlite`)
34. Schema migrations — idempotent `migrate()` with version tracking
35. `EventStore` — durable event log in SQLite with global sequence numbers
36. `AuditStore` — keyed HMAC audit chain persistence
37. `buildDurableAgentRun` — composition root for durable, audited agent runs
38. `openjarvis-run` CLI — durable agent run entrypoint
39. Health checks — runtime verification

---

## Memory (`@openjarvis/memory`)

40. `JarvisMemoryStore` — decay-aware memory with fragment recall
41. Pure-JS vector embeddings via `TransformersEmbedder` (@huggingface/transformers, optional peer dep)
42. FTS5 lexical fallback — full-text search with escaped tokens (injection-safe)
43. `asMemoryStore` adapter — bridges `JarvisMemoryStore` to core `MemoryStore` interface
44. Fragment scoring — time-decay, importance, taint, reinforcement
45. `VecnaStore` backward-compatible alias

---

## Document Processing (`@openjarvis/markdownify`)

46. `ConverterRegistry` — never-throws registry for document converters
47. CSV to Markdown converter
48. HTML to Markdown converter (via turndown)
49. JSON to Markdown converter
50. XML to Markdown converter (via fast-xml-parser)
51. Plain text to Markdown converter

---

## Nexus Orchestrator (`@openjarvis/jarvis`)

### Intent & Routing

52. `RuleBasedRouter` — 30+ intent actions mapped to 14 specialist agents
53. `IntentRouter` interface — pluggable routing strategy

### Agent Management

54. `InProcessAgentPool` — 14 agents (general, research, system, weather, calendar, browser, vision, discord, telegram, web, email, notion, cron, secrets, slow)
55. `AgentSession` — sub-agent spawning with timeout enforcement
56. Capability matching — agents declare `CapabilityName[]`, tools declare required capabilities

### Orchestration

57. `NexusEngine` — parallel/sequential dispatch, result synthesis
58. `TaskBoard` — task tracking with LRU eviction (max 1000)
59. `ReplayEngine` — orchestration session replay

### Tools & Composition

60. `ToolComposition` — compose multiple skill packages into a single registry
61. 30+ tools registered: discord (3), telegram (2), web fetch, browser (8), email (4), calendar (5), notion (4), weather (2), secrets (1), cron (3), disk_free, document_convert

### Voice

62. `OllamaSttEngine` — voice transcription via Ollama Whisper
63. `AmplitudeWakeWordEngine` — amplitude-based wake word detection with cooldown
64. `AudioRecorder` — browser-based audio recording with PCM capture
65. `useVoicePipeline` — React hook for voice pipeline state management

### Vision & Display

66. `VisionEngine` — detection, presence, events
67. `DisplayManager` interface — openApp, openUrl, showText, clear, highlight, openVisionFeed, showAgentOutput, showContextCard
68. Visual command dispatch — 8 visual command types routed through display manager

### Hub & Events

69. `JarvisHub` — main hub composition with wake word → speak flow
70. `SimpleEventBus` — pub/sub event bus with error isolation

---

## Built-in Agents (`@openjarvis/agents`)

71. `VisionAgent` — vision detection delegator
72. `MockVisionAgent` — mock for testing
73. `AgentDelegator` / `DelegatorResult` — agent delegation pattern

---

## Desktop App (`@openjarvis/desktop`)

74. Electron main process — window creation, lifecycle, single-instance lock
75. `DesktopStore` — persistent settings with Zod validation and atomic writes
76. Typed IPC bridge — settings and user profile persistence between main/renderer
77. `resolveSecrets` — `op://` auto-resolution for config secrets via 1Password CLI
78. `NexusBridge` — bridge between NexusEngine and Electron renderer UI

---

## Channels (`@openjarvis/channels`)

### Discord

79. Raw WebSocket gateway — direct Discord WS connection with heartbeat + reconnection + INVALID_SESSION handling
80. Rate-limited REST client — per-bucket rate limiting, Retry-After, 429 retry, path-specific buckets
81. Session mapper — `channelToSession` / `sessionToChannel` mapping
82. Slash commands — registration and handling
83. 5 event handlers — MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE, INTERACTION_CREATE, TYPING_START
84. `discord_send` tool (approval-gated)
85. `discord_read` tool
86. `discord_search` tool

### Telegram

87. Telegram Bot — long-polling with exponential backoff, AbortController timeout
88. Session mapper — chat-to-session routing with LRU eviction
89. `telegram_send` tool
90. `telegram_read` tool

---

## Cron Scheduler (`@openjarvis/cron`)

91. `CronScheduler` — real cron scheduling with node-cron
92. `SqlCronStore` — SQLite persistence for cron jobs (save, load, update, remove)
93. `CronPersistence` interface — pluggable storage backend
94. Error-resilient restore — skips invalid cron expressions on startup
95. `cron_schedule` tool
96. `cron_list` tool
97. `cron_cancel` tool

---

## Web Skills (`@openjarvis/skills-web`)

98. `web_fetch` tool — URL to Markdown with rate limiting
99. `browser_navigate` tool (approval-gated)
100.  `browser_click` tool (approval-gated)
101.  `browser_type` tool (approval-gated)
102.  `browser_screenshot` tool
103.  `browser_accessibility` tool — accessibility tree extraction with `parseAriaSnapshot`
104.  `browser_list_tabs` tool
105.  `browser_switch_tab` tool
106.  `browser_close_tab` tool (approval-gated)
107.  `PlaywrightBrowserAutomation` — concurrent-init serialization, page leak prevention, bringToFront on tab switch

---

## Email Skills (`@openjarvis/skills-email`)

108. Gmail IMAP client — email reading via IMAP with search query parsing
109. Gmail SMTP sender — email sending
110. `GmailEmailClient` — combined Gmail client
111. Microsoft Graph OAuth — OAuth2 device code flow with token refresh mutex (concurrent refresh race prevention)
112. `GraphEmailClient` — Microsoft Graph email with 429/5xx retry
113. `email_search` tool
114. `email_read` tool
115. `email_draft` tool
116. `email_send` tool (approval-gated)

---

## Calendar Skills (`@openjarvis/skills-calendar`)

117. `GraphCalendarClient` — Microsoft Graph Calendar API with 429/5xx retry
118. Recurring event creation support
119. Configurable default timezone
120. `calendar_list` tool
121. `calendar_get_events` tool
122. `calendar_create` tool (approval-gated, with recurrence)
123. `calendar_update` tool (approval-gated)
124. `calendar_delete` tool (approval-gated)

---

## Notion Skills (`@openjarvis/skills-notion`)

125. `NotionClient` — Notion API with 429 retry and JSON.parse error handling
126. `notion_query` tool
127. `notion_get` tool
128. `notion_create` tool
129. `notion_update` tool

---

## Weather Skills (`@openjarvis/skills-weather`)

130. `weather_current` tool (wttr.in)
131. `weather_forecast` tool (wttr.in)

---

## Secrets Skills (`@openjarvis/skills-secrets`)

132. `OpClient` — 1Password CLI client
133. `secrets_get` tool (approval-gated)

---

## Process Enforcement (`@openjarvis/process`)

134. `ProcessEngine` — AGENT.md loop runtime enforcement with phase dependencies
135. `Gate` — process gate validation
136. `Hooks` — lifecycle hooks for process stages
137. `ProcessEventBus` — event bus for process events with error isolation
138. `ProcessManifest` — process definition schema
139. `ProcessCli` — CLI for process enforcement

---

## Multi-Device Sync (`@openjarvis/track-b`)

140. `DeviceIdentity` — device identification
141. `DeviceRegistry` — device registration and management
142. `KeyPair` — cryptographic key pair generation
143. `Pairing` — device pairing protocol
144. `VectorClock` — CRDT vector clock
145. `EventSync` — event synchronization via CRDT
146. `MemorySync` — memory synchronization via CRDT
147. `VaultSync` — vault synchronization via CRDT
148. `Discovery` — network device discovery
149. `NoiseProtocol` — encrypted communication (mock cipher for testing)
150. `Channel` — network channel abstraction
151. `Router` — task routing
152. `Queue` — task queue management

---

## Skill Infrastructure (`@openjarvis/skills`)

153. `Manifest` — skill manifest definition
154. `Loader` — skill loading
155. `Sandbox` — capability sandboxing for plugins

---

## Cross-Cutting Infrastructure

156. Docker CI gate — required Docker-based CI (build, lint, format, ≥99% coverage, unit + functional tests)
157. Cross-platform — runs on both Node and Bun (CI matrix)
158. Embedded SQLite — no external DB requirement
159. Single self-contained binary — via Bun `--compile`
160. Production-readiness hardening — 9 rounds of architecture + wiring audits with all issues resolved:


    - 3 CRITICAL bugs fixed (vault parse, 429 loops, event-store pagination)
    - 28 HIGH bugs fixed (timer leaks, timeouts, rejections, error handling, capability mismatches)
    - 33 MEDIUM bugs fixed (mutations, concurrency, persistence, routing, type safety)
    - 10 LOW issues fixed (dead deps, type consistency, logging, format)
    - 21+ wiring gaps closed (tool registrations, routes, exports, dependencies, adapters)
