# JARVIS-like Open-Source Assistants — Feature-Gap Analysis

**Date:** 2026-06-17  
**Scope:** Compare the OpenJarvis monorepo (TypeScript, local-first, multi-device) against the most-starred / most-interesting JARVIS-style open-source assistants on GitHub.  
**Method:** README-level feature extraction only; no source-code audits. Features marked with “(?)” could not be confidently verified from the README.

---

## 1. Summary of Current OpenJarvis Capabilities

OpenJarvis is a **self-owned, local-first AI-agent runtime** built as a TypeScript monorepo. The thesis is _“the model proposes, the runtime enforces”_ — every assistant action is grounded, capability-gated, auditable, and reproducible.

### Packages and status (from `CHECKPOINT.md`)

| Package                   | Status      | Role                                                                                                                                                  |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openjarvis/core`        | Done        | Agent loop, model adapters, `ToolRegistry`, `GroundingEngine`, `Audit`, `Vault`, `Gate` taint/approval, Playbook process engine                       |
| `@openjarvis/state`       | Done        | SQLite event store, keyed audit chain, durable `buildDurableAgentRun` / `openjarvis-run` CLI                                                          |
| `@openjarvis/memory`      | Done        | Decay-aware memory (`JarvisMemoryStore`), pure-JS embeddings + FTS5 fallback, wired into agent path                                                   |
| `@openjarvis/markdownify` | Done        | Document → Markdown converters behind `ConverterRegistry`, wired into agent path                                                                      |
| `@openjarvis/jarvis`      | Done        | Vision skill interfaces, E2E automation suite, **S3 Nexus Orchestrator** (IntentRouter, AgentPool, Synthesizer, NexusEngine, TaskBoard, ReplayEngine) |
| `@openjarvis/agents`      | Done        | Built-in `VisionAgent` / `MockVisionAgent`                                                                                                            |
| `@openjarvis/desktop`     | In progress | Electron Iron Man neon dashboard; components wired to NexusContext via mock bridge (PR #39)                                                           |
| `@openjarvis/track-b`     | Done        | Multi-device sync: device identity, CRDT sync, Noise protocol, task router, vault sync                                                                |
| `@openjarvis/process`     | Done        | AGENT.md loop runtime enforcement with `ProcessEngine`, gate checks, lifecycle hooks, event bus                                                       |

### What is already built and proven

- **Durable, event-sourced agent core** with deterministic replay and hash-chained audit.
- **Native tool-calling** with a model-call budget and default-deny capability gating.
- **Model adapters** for Ollama + OpenAI-compatible endpoints, with a `ScriptedAdapter` for testing.
- **GroundingEngine** with `off/preferred/required/cited` levels and citation verification.
- **Vault** for encrypted secrets, plus external audit anchoring.
- **Multi-device sync** (Track B) over LAN via mDNS + Noise, with capability-aware task routing.
- **Desktop app skeleton** with neon HUD, onboarding design spec, and Nexus bridge plan.

### What is explicitly not yet implemented (from `CHECKPOINT.md` §5 and desktop plan)

- Real Electron main-process IPC to `NexusEngine`.
- Real audio analysis / voice waveform (currently mocked).
- Settings persistence.
- Plugin SDK / registry.
- Gateway (network API).
- CLI binary packaging.

### Design intent (from `docs/specs/2026-06-10-track-b-personal-assistant.md`)

OpenJarvis is **one user, one brain, multiple devices**. Data never leaves the user’s network; there is no cloud relay, no multi-tenancy, no public API. Native apps are planned for desktop (Electron) and mobile (Flutter).

---

## 2. External Repo Feature Inventory

Features below are grouped by repository and derived from READMEs only.

### 2.1 sukeesh/Jarvis — 3,528 ⭐ / 1,148 🍴

_“Personal Assistant for Linux and macOS”_ — a command-line, non-AI plugin assistant.

- Voice output (`pyttsx3`, optional)
- Entertainment / bored suggestions, taste dive, mood music
- Sports: basketball, cricket, soccer, tennis
- Games: blackjack, connect four, hangman, rock-paper-scissors, roulette, tic-tac-toe, wordle, etc.
- Health & fitness: BMI, BMR, calories, food recipes, fruit nutrition, workouts
- Cocktail recipes
- Random generators (list, number, password)
- Unit conversions (binary, currency, hex, length, mass, speed, temperature, time)
- Photography: open camera, screenshot
- System info: battery, DNS, host info, IP, network scan, speedtest, RAM, OS info
- File management and file organizer
- Image upload/edit/convert/compress, image → PDF
- Web → PDF, PDF → images
- Jokes, facts, daily jokes, Chuck Norris jokes, cat facts
- Calculations, equations, plotting, matrices
- QR code generation
- Weather report
- Language translation
- Stock / crypto tracker
- Plugin SDK (`@plugin` decorator, `custom/` folder)
- Docker support

### 2.2 kalliope-project/kalliope — 1,762 ⭐ / 231 🍴

_Framework for building your own personal assistant_ — YAML “brain” of signals → neurons.

- Wake-word / voice order recognition
- Scheduled event triggers
- MQTT and GPIO event triggers
- Text-to-speech synthesis
- Multi-language support
- Pre-built neuron marketplace
- Custom neuron authoring
- Runs on Linux / Debian / Raspberry Pi
- Companion Android app
- Docker support
- PyPI package
- Home-automation oriented

### 2.3 GauravSingh9356/J.A.R.V.I.S — 1,240 ⭐ / 303 🍴

_Python personal assistant with a face-recognition gate._

- Face-recognition authentication
- Send emails
- Dynamic news reporting via API
- Todo list generator / remembers todos
- Open websites by voice command
- Play music
- Tell time
- Wikipedia search
- Dictionary with auto spell-check
- Weather report (temp, wind, humidity)
- Latitude / longitude lookup
- YouTube search
- Google Maps search
- YouTube video downloader
- Switch between J.A.R.V.I.S and F.R.I.D.A.Y voices
- OCR (`pytesseract`) via `OCR.py`
- Amazon price tracking (`amazon.py`)
- Voice I/O (`pyttsx3`, `speech_recognition`)

### 2.4 isair/jarvis — 1,223 ⭐ / 217 🍴

_100% private, offline AI voice assistant with MCP integration._

- 100% local processing (Ollama-based)
- Conversational awareness / multi-person context
- Unlimited memory + Memory Viewer GUI
- Knowledge-graph memory, auto-split by topic
- Adaptive tone (code/business/wellbeing)
- Smart tool selection with embedding relevance filtering
- Built-in tools: screenshot OCR, web search, weather, file access, nutrition tracking, location awareness
- Natural wake word placement anywhere in sentence
- “Stop” interruption
- Echo detection
- Free offline dictation mode (global hotkey)
- MCP server integration (Home Assistant, GitHub, Slack, Notion, databases, Composio, etc.)
- Browser automation via MCP
- Piper TTS + Chatterbox voice cloning TTS
- Local GeoLite2 location detection
- Privacy hardening toggles
- Settings GUI
- Cross-platform binaries (Windows, macOS, Linux)

### 2.5 Gladiator07/JARVIS — 638 ⭐ / 286 🍴

_Python voice assistant with Qt GUI._

- Greet user
- Current time / date
- Launch applications
- Open any website
- Weather for any city
- Location lookup + distance calculation
- System status (RAM, battery, CPU)
- Google Calendar events
- Wikipedia search
- Google search
- Play songs on YouTube
- News headlines (Times of India)
- Play local music
- Send email
- Mathematical expression calculator (WolframAlpha)
- Take notes in Notepad
- Random jokes
- IP address lookup
- Switch active window
- Screenshot with custom filename
- Hide / unhide files in a folder
- Qt-based GUI (`gui.ui`)

### 2.6 ethanplusai/jarvis — 633 ⭐ / 206 🍴

_Voice-first macOS assistant with Claude Code integration and Three.js orb._

- Voice conversation with spoken responses
- Build software by spawning Claude Code sessions
- Apple Calendar read
- Apple Mail read (read-only by design)
- Web browsing / search
- Task management / reminders
- Notes (Apple Notes)
- Persistent memory (preferences, facts) with SQLite FTS5
- Day planning combining calendar, tasks, priorities
- Screen context awareness
- Audio-reactive Three.js particle orb
- Action tag system: `[ACTION:BUILD]`, `[ACTION:BROWSE]`, `[ACTION:RESEARCH]`, `[ACTION:PROMPT_PROJECT]`, `[ACTION:ADD_TASK]`, `[ACTION:REMEMBER]`
- FastAPI backend + Vite/TypeScript frontend
- WebSocket + binary audio streaming
- Fish Audio TTS with JARVIS voice model
- Claude Haiku for fast replies, Claude Opus for deep work
- AppleScript bridges for macOS apps

### 2.7 akshayaggarwal99/jarvis-ai-assistant — 565 ⭐ / 88 🍴

_TypeScript/Swift dictation-first assistant for Mac (and iOS TestFlight)._ Signed, notarized DMG releases.

- Hold-key (Fn) dictation → clean, punctuated text anywhere
- Filler-word removal (“um”, “like”)
- Grammar fix / rephrase / bullet-point / text generation
- Tiny actions: “open YouTube”, “set 5-min timer”
- Fully customizable prompts
- Fully offline mode: local Whisper or NVIDIA Parakeet via Sherpa-ONNX
- Local LLMs via Ollama
- Cloud speed option: Deepgram + Gemini
- Zero telemetry
- Keyboard shortcuts: Fn hold, Fn double-tap hands-free, Escape cancel
- Signed & notarized Mac app
- iOS TestFlight companion

### 2.8 AlexandreSajus/JARVIS — 525 ⭐ / 100 🍴

_Voice → Deepgram → OpenAI GPT-3 → ElevenLabs → Pygame → Taipy web UI._

- Voice input via microphone
- Deepgram STT
- OpenAI GPT-3 response generation
- ElevenLabs TTS
- Web interface via Taipy showing conversation
- Terminal + web interface synced state

### 2.9 gia-guar/JARVIS-ChatGPT — 454 ⭐ / 105 🍴 _(archived)_

_Voice assistant with synthetic J.A.R.V.I.S-style voice and research mode._

- OpenAI Whisper STT
- ChatGPT / OpenAI API response generation
- IBM Watson TTS
- ElevenLabs voice
- Tacotron local voice generation
- Voice summoning / wake word
- Project memory: stores chats, events, timelines
- Research mode (Semantic Scholar, core paper expansion, Refy)
- Web-surfing agents (LangChain)
- Save / title conversations
- International language support
- Sound feedback chimes

### 2.10 Dipeshpal/Jarvis_AI — 402 ⭐ / 119 🍴

_Library / module for building your own assistant._

- Voice or text input/output
- Whisper ASR option
- Google Speech API option
- `pyttsx3` TTS
- Custom user-defined actions
- Server-side intent handling
- Commands: time, date, greeting, jokes, “tell me about”, “I am bored”, volume, news, photo, places, YouTube, games, weather, screenshot, website, WhatsApp, COVID cases, internet speed

### 2.11 llm-guy/jarvis — 322 ⭐ / 106 🍴

_Minimal local LLM voice assistant with LangChain tool-calling._

- Wake word “Jarvis”
- Local LLM via Ollama (`qwen3:1.7b`)
- LangChain tool-calling
- `pyttsx3` TTS
- Example tool: current time in a city
- Optional OpenAI integration

### 2.12 SreejanPersonal/JARVIS-AGI — 264 ⭐ / 49 🍴

_Multi-provider “AGI” voice assistant with many free API fallbacks._

- Speech recognition (multiple STT backends)
- Text generation via many free API providers (Blackbox, DeepInfra, Le Chat, Phind, Pi, Hugging Chat, etc.) and local `llama.cpp`
- Image generation and vision analysis
- TTS via DeepGram, ElevenLabs, edge-tts, speechify, etc.
- Hotword detection
- Audio playback interruption
- System settings control (theme, taskbar)
- ADB phone-call automation
- Camera vision
- Clap detection NN
- Website assistant / Chrome URL reader
- Proxy API rotation
- Conversation history stored as JSON

### 2.13 ashutoshkrris/Virtual-Personal-Assistant-using-Python — 344 ⭐ / 141 🍴

_Tutorial-style Python assistant (freeCodeCamp article)._ README is sparse; features inferred from code files and article reference.

- Voice I/O (`pyttsx3`)
- Greeting
- Time / date
- Wikipedia search
- Weather (OpenWeatherMap)
- News headlines (NewsAPI)
- Movie info (TMDB)
- Send email
- Open websites / apps
- Take screenshot

### 2.14 AnubhavChaturvedi-GitHub/jarvis-ai-assistant — 245 ⭐ / 38 🍴

_Voice-activated assistant with NLP and several automation modules._ README is high-level; feature folders listed in repo.

- Speech recognition
- NLP intent handling
- Automation scripts (folder present)
- Brain / memory module (folder present)
- Real-time operations module (folder present)
- Text-to-image generation
- Text-to-speech
- Time operations / alarms
- Vision / camera capture
- Weather check
- WhatsApp automation
- Tkinter UI (`ui.py`)

---

## 3. Consolidated Feature Matrix

Rows = common assistant capabilities. Columns = OpenJarvis + each compared repo. `✅` = README-verified or clearly implemented. `❌` = clearly absent or not mentioned. `?` = could not verify from README / unclear. `~` = partially present or in-progress.

| Capability                              | OpenJarvis           | sukeesh          | kalliope   | GauravSingh   | isair              | Gladiator07   | ethanplusai       | akshayaggarwal    | AlexandreSajus | gia-guar          | Dipeshpal     | llm-guy      | Sreejan AGI   | ashutoshkrris | AnubhavChaturvedi |
| --------------------------------------- | -------------------- | ---------------- | ---------- | ------------- | ------------------ | ------------- | ----------------- | ----------------- | -------------- | ----------------- | ------------- | ------------ | ------------- | ------------- | ----------------- |
| **Voice input / STT**                   | ~ (desktop mock)     | ✅               | ✅         | ✅            | ✅                 | ✅            | ✅                | ✅                | ✅ Deepgram    | ✅ Whisper        | ✅            | ✅           | ✅            | ✅            | ✅                |
| **Voice output / TTS**                  | ❌                   | ✅               | ✅         | ✅            | ✅                 | ✅            | ✅                | ✅                | ✅ ElevenLabs  | ✅                | ✅            | ✅           | ✅            | ✅            | ✅                |
| **Wake word / hotword**                 | ❌                   | ❌               | ✅         | ~ (face auth) | ✅                 | ❌            | ❌                | ❌                | ❌             | ✅                | ❌            | ✅           | ✅            | ❌            | ❌                |
| **LLM-powered chat / reasoning**        | ✅                   | ❌               | ❌         | ❌            | ✅                 | ❌            | ✅                | ✅                | ✅             | ✅                | ~             | ✅           | ✅            | ❌            | ~                 |
| **Native tool-calling / plugins**       | ✅                   | ✅               | ✅         | ~ scripts     | ✅                 | ~ scripts     | ✅                | ✅                | ❌             | ✅ LangChain      | ✅            | ✅ LangChain | ~             | ~ scripts     | ~                 |
| **Web search**                          | ~ (via tools?)       | ✅               | ~          | ✅            | ✅                 | ✅            | ✅                | ✅                | ~              | ✅                | ✅            | ❌           | ✅            | ✅            | ?                 |
| **Weather**                             | ~ (via tools?)       | ✅               | ?          | ✅            | ✅                 | ✅            | ~                 | ❌                | ❌             | ?                 | ✅            | ~ time only  | ?             | ✅            | ✅                |
| **Email send/read**                     | ❌                   | ❌               | ?          | ✅ send       | ❌                 | ✅ send       | ✅ read Mail      | ?                 | ❌             | ❌                | ✅ send       | ❌           | ?             | ✅ send       | ?                 |
| **Calendar**                            | ❌                   | ❌               | ?          | ❌            | ❌                 | ✅ Google     | ✅ Apple          | ❌                | ❌             | ❌                | ❌            | ❌           | ?             | ❌            | ✅ time ops       |
| **Notes / todos**                       | ~ (memory only)      | ❌               | ?          | ✅ todo       | ❌                 | ✅ notes      | ✅ Apple Notes    | ❌                | ❌             | ✅ project memory | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Screenshot / OCR**                    | ❌                   | ✅ screencapture | ❌         | ✅ OCR        | ✅ OCR             | ✅ screenshot | ✅ screen context | ❌                | ❌             | ?                 | ✅ screenshot | ❌           | ✅ camera     | ✅ screenshot | ✅ vision         |
| **File system tools**                   | ✅                   | ✅               | ?          | ❌            | ✅                 | ❌            | ✅                | ❌                | ❌             | ?                 | ✅            | ❌           | ?             | ❌            | ?                 |
| **System info / monitoring**            | ✅ host info         | ✅               | ❌         | ✅            | ✅                 | ✅            | ✅                | ❌                | ❌             | ❌                | ✅            | ~ time       | ✅            | ✅            | ?                 |
| **Persistent memory / recall**          | ✅ JarvisMemoryStore | ❌               | ❌         | ✅ todo       | ✅ knowledge graph | ✅ memory.py  | ✅ SQLite FTS5    | ❌                | ❌             | ✅ project memory | ❌            | ❌           | ✅ convo JSON | ❌            | ✅ Brain          |
| **Multi-device sync**                   | ✅ Track B           | ❌               | ❌         | ❌            | ❌                 | ❌            | ❌                | ✅ iOS            | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Desktop GUI / HUD**                   | ~ (Electron mock)    | ✅ CLI           | ❌         | ✅ Qt GUI     | ✅ Memory Viewer   | ✅ Qt GUI     | ✅ Three.js orb   | ✅ Mac app        | ✅ Taipy web   | ✅                | ❌            | ❌           | ✅ Tkinter UI | ❌            | ✅ Tkinter        |
| **Mobile app**                          | planned (Flutter)    | ❌               | ✅ Android | ❌            | ❌                 | ❌            | ❌                | ✅ iOS TestFlight | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Local / offline first**               | ✅                   | ~                | ~          | ❌            | ✅                 | ❌            | ❌                | ✅                | ❌             | ❌                | ~             | ✅           | ❌            | ❌            | ❌                |
| **MCP / external tool protocol**        | ❌                   | ❌               | ❌         | ❌            | ✅                 | ❌            | ❌                | ❌                | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Audit / provenance / gate**           | ✅                   | ❌               | ❌         | ❌            | ~ redaction        | ❌            | ❌                | ❌                | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Document ingestion / markdownify**    | ✅                   | ✅ image/pdf     | ❌         | ✅ OCR        | ✅                 | ❌            | ❌                | ❌                | ❌             | ✅ research docs  | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Developer/build automation**          | ~ (VisionAgent)      | ❌               | ❌         | ❌            | ❌                 | ❌            | ✅ Claude Code    | ❌                | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Settings persistence / GUI prefs**    | ❌                   | ❌               | ❌         | ❌            | ✅                 | ❌            | ✅ .env           | ✅ settings       | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Packaged binary / installer**         | ❌                   | ✅ Docker        | ~          | ❌            | ✅                 | ❌            | ❌                | ✅ DMG            | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |
| **Privacy / redaction / local storage** | ✅ Vault + audit     | ❌               | ❌         | ❌            | ✅                 | ❌            | ❌                | ✅ zero telemetry | ❌             | ❌                | ❌            | ❌           | ❌            | ❌            | ❌                |

### Notes on the matrix

- OpenJarvis has **strong infrastructure** (audit, grounding, memory, sync, gate) but **weak end-user voice/UI coverage** compared with the field.
- `isair/jarvis` is the closest philosophical competitor: local-first, memory-heavy, privacy-first, MCP-extensible, voice-first. It is also the only one besides OpenJarvis with a clear offline/privacy story.
- `ethanplusai/jarvis` is the strongest **developer-productivity** oriented assistant because it can spawn Claude Code and read Apple data.
- `akshayaggarwal99/jarvis-ai-assistant` is the strongest **dictation-first / input augmentation** competitor.
- `sukeesh/Jarvis` and `kalliope` are the strongest **traditional plugin/script ecosystems**.

---

## 4. Gap List

Features present in external repos but **missing or incomplete** in OpenJarvis today.

### 4.1 User-facing interaction gaps

1. **Real voice input (STT)** — every popular competitor has speech recognition; OpenJarvis only has a mocked waveform.
2. **Text-to-speech (TTS)** — no spoken responses yet.
3. **Wake-word / hotword detection** — only `isair`, `llm-guy`, `gia-guar`, `kalliope`, `Sreejan AGI` have this.
4. **Real audio analysis for the voice waveform** — desktop plan explicitly calls this out as not yet done.
5. **Dictation mode** — `isair` and `akshayaggarwal99` offer global hotkey dictation; not on OpenJarvis roadmap yet.
6. **Interrupt / “stop” handling and echo detection** — `isair` has this; OpenJarvis has no voice loop.

### 4.2 End-user utility gaps

7. **Weather tool** — common across almost every repo; OpenJarvis may or may not expose it through existing tools (unclear from README/specs).
8. **Web search tool** — present in `isair`, `ethanplusai`, `Gladiator07`, `GauravSingh`, etc.; OpenJarvis grounding focuses on cited local documents, not live web search.
9. **Email integration** — read or send email is a top user request; absent.
10. **Calendar integration** — Apple/Google calendar read is in `ethanplusai` and `Gladiator07`; absent.
11. **Notes / todos with explicit CRUD** — OpenJarvis has memory fragments, but no explicit task/note tool surfaced to users.
12. **Screenshot + OCR** — `isair`, `GauravSingh`, `Gladiator07`, `ethanplusai` have screen context; OpenJarvis has `markdownify` but no screen capture.
13. **System control / app launching / AppleScript** — `ethanplusai` and `Gladiator07` launch apps; OpenJarvis has `host:info` only.
14. **News headlines** — `GauravSingh`, `Gladiator07`, `Dipeshpal`, `ashutoshkrris`; absent.
15. **Music / media playback** — `GauravSingh`, `Gladiator07`, `sukeesh`; absent.
16. **Calculator / unit conversion / QR / translation** — `sukeesh` suite; absent.
17. **Developer-specific actions (spawn Claude Code, browser automation)** — `ethanplusai` only; a natural differentiation area.

### 4.3 Extensibility / ecosystem gaps

18. **MCP server integration** — `isair` is the clear leader; OpenJarvis has a custom tool registry but no MCP bridge.
19. **Plugin SDK / registry** — listed in `CHECKPOINT.md` as a future item; `sukeesh` and `kalliope` already have this.
20. **Settings persistence and user preferences** — listed as future in `CHECKPOINT.md`.
21. **Packaged binary / installer** — listed as future; competitors (`isair`, `akshayaggarwal99`) ship signed binaries.
22. **Mobile app (Flutter)** — planned but not implemented; `akshayaggarwal99` has iOS TestFlight and `kalliope` has Android.

### 4.4 Capabilities OpenJarvis already leads on

- Durable event sourcing + replay
- Hash-chained audit + external anchoring
- Capability-gated tool registry
- Grounding engine with citation verification
- Multi-device encrypted sync
- Process enforcement / gate runtime
- Local-first / no-cloud architecture

---

## 5. Recommended Top 5–7 Features to Implement Next

Ordered by **impact/differentiation**, with effort estimates and rationale.

### 1. Voice loop: STT + TTS + wake word

- **Effort:** Large
- **Rationale:** This is the single largest gap versus every starred competitor. Without it, OpenJarvis remains a CLI/agent framework rather than a “Jarvis” assistant. It also unlocks the existing desktop waveform UI.
- **Scope:** Add a `@openjarvis/voice` package (or extend `@openjarvis/desktop`) with Whisper/Sherpa-ONNX STT, Piper/edge-tts TTS, and an optional wake-word listener. Wire it through the agent loop so the desktop HUD shows real listening/speaking states.

### 2. MCP bridge / tool adapter

- **Effort:** Medium–Large
- **Rationale:** `isair/jarvis` differentiates heavily on MCP. OpenJarvis already has a rigorous `ToolRegistry` and capability gate; adding an MCP-to-tool adapter lets it tap thousands of existing servers (Home Assistant, GitHub, Slack, etc.) without rebuilding each integration.
- **Scope:** Implement an MCP client that discovers servers, maps tools into `ToolRegistry` entries, and enforces the existing capability/approval model.

### 3. Realtime web search + weather tool

- **Effort:** Small–Medium
- **Rationale:** Weather and web search are the two most common “assistant” commands and appear in nearly every repo. They are high user-perceived value and relatively bounded to implement as grounded tools with citations.
- **Scope:** Add `web:search` (DuckDuckGo / Brave / SearXNG with fetch) and `weather:current` tools, require explicit user approval for network calls, and cite sources via `GroundingEngine`.

### 4. Settings persistence + user profile

- **Effort:** Small
- **Rationale:** Listed in `CHECKPOINT.md` as next. Required for onboarding completion, locale, voice model selection, and per-device capability grants. Enables many downstream features.
- **Scope:** SQLite-backed settings table, encrypted by Vault, with a simple schema for user name, locale, voice prefs, and device grants.

### 5. Desktop ↔ NexusEngine real IPC bridge

- **Effort:** Medium
- **Rationale:** PR #39 wires the UI to a **mock** bridge. Replacing it with real main-process IPC turns the dashboard from a demo into a functional control surface and unblocks voice loop integration.
- **Scope:** Electron `preload.ts` exposes a typed API; main process spawns the OpenJarvis daemon and forwards Nexus events over IPC; renderer consumes real task/agent/conversation events.

### 6. Screenshot + OCR tool

- **Effort:** Medium
- **Rationale:** High user value for “what’s on my screen?” questions and a natural fit for OpenJarvis’s local-first, privacy-first model (screen data never leaves the device). Many competitors have this.
- **Scope:** Add a cross-platform screen-capture tool (Electron built-in for desktop, platform APIs later) and pipe the image through a local OCR or vision model, then into the agent context with grounding.

### 7. Plugin SDK / registry (or package-based tools)

- **Effort:** Large
- **Rationale:** Matches `sukeesh` and `kalliope` extensibility while playing to OpenJarvis’s TypeScript monorepo strength. Lets the community add tools without modifying core.
- **Scope:** Define a tool manifest schema, dynamic import path, capability declaration, and a simple local registry index. Start with internal packages as “plugins” before opening to third-party installs.

### Honorable mentions / not in top 7

- **Email integration** — high value but complex OAuth/security surface; defer until core voice loop and MCP are in place.
- **Calendar integration** — similar to email; good candidate after MCP bridge because calendar MCP servers already exist.
- **Dictation mode** — strong differentiation but overlaps with `akshayaggarwal99`; can follow the voice loop.
- **Packaged binary / installer** — important for distribution but mostly packaging work; defer until desktop app is functional.
- **Mobile Flutter app** — large effort; Track B sync core exists but UI is not built. Defer until desktop experience is solid.

---

## 6. Sources and Caveats

- GitHub search results were provided by pre-fetched tool outputs stored at:
  - `/Users/parijatmukherjee/.local/share/opencode/tool-output/tool_ed2785e7e0013PPqSCZd20S4KE`
  - `/Users/parijatmukherjee/.local/share/opencode/tool-output/tool_ed2785e77001Y1sf2DUOe2PhA6`
- READMEs were fetched via `webfetch` on 2026-06-17 for the 14 repos listed in §2.
- OpenJarvis capabilities were derived from `CHECKPOINT.md`, `docs/specs/2026-06-11-jarvis-desktop-app-design.md`, `docs/specs/2026-06-10-track-b-personal-assistant.md`, and `docs/plans/2026-06-11-jarvis-desktop-app-plan.md`.
- `docs/specs/2026-06-05-openjarvis-design.md` did not exist at the time of analysis.
- **Limitation:** This report is based on READMEs and design docs only. Actual code completeness, quality, and edge-case behavior of external projects were not verified.
