# OpenHawkins Vision: Jarvis — Your Personal AI Hub

**Date:** 2026-06-10  
**Status:** Canonical — all design, code, and implementation must align with this document.  
**Author:** Parijat Mukherjee

---

## 1. Core Thesis

**OpenHawkins is Jarvis — a physical AI hub** that lives on a dedicated mini PC in your home, always listening, always ready. You speak to it naturally; it responds by voice, opens the right apps on your monitors, and coordinates a team of specialized AI agents to get things done.

**Jarvis is the leader. You only talk to Jarvis.** Jarvis delegates to agents, manages context, and presents results. It runs locally on your hardware — your data never leaves your network.

---

## 2. Vision Pillars

### Pillar 1: Always-On Physical Hub

| Aspect               | Detail                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Hardware**         | Dedicated mini PC (e.g., Intel NUC, Raspberry Pi 5, Apple Mac Mini) running 24/7                 |
| **Wake word**        | Voice-activated (e.g., "Jarvis", "Hey OpenHawkins") — runs a lightweight wake-word model locally |
| **Always listening** | Microphone array processes audio locally; no cloud voice processing                              |
| **Proactive**        | Can initiate conversations: "You have a meeting in 10 minutes"                                   |
| **Visual**           | Connected to one or more monitors — opens apps, websites, dashboards on screen                   |

### Pillar 2: Voice-First, Visual-Second

| Aspect             | Detail                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Input**          | Primary: voice commands. Secondary: keyboard/mouse via Electron dashboard                   |
| **Output**         | Primary: spoken responses via TTS (local, fast). Secondary: visual on monitor               |
| **Context**        | "Show me my calendar" → opens calendar app on monitor + speaks: "You have 3 meetings today" |
| **Multi-monitor**  | Can open different apps/windows on different monitors simultaneously                        |
| **Conversational** | Natural dialogue with memory of previous turns in the session                               |

### Pillar 3: Jarvis is the Single Interface

| Aspect                        | Detail                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **User talks to Jarvis only** | No direct interaction with sub-agents                                          |
| **Jarvis delegates**          | Breaks down requests, assigns to agents, synthesizes results                   |
| **Jarvis explains**           | "I'm asking the research agent to find this; I'll get back to you in a moment" |
| **Jarvis coordinates**        | Multiple agents can work in parallel; Jarvis presents unified results          |
| **Jarvis learns preferences** | Remembers how you like things formatted, which apps you prefer                 |

### Pillar 4: Team of Specialist Agents

| Agent              | Role                                          | Example Task                                         |
| ------------------ | --------------------------------------------- | ---------------------------------------------------- |
| **Research Agent** | Web search, data gathering, fact-checking     | "Find me the best mechanical keyboards under $150"   |
| **System Agent**   | OS operations, file management, app launching | "Open my Q4 financial report in LibreOffice"         |
| **Code Agent**     | Programming, debugging, code review           | "Write a Python script to rename these files"        |
| **Vision Agent**   | Image analysis, OCR, visual understanding     | "What's in this photo?" (user shows photo to camera) |
| **Comm Agent**     | Messaging, email, notifications               | "Send an email to the team about the delay"          |
| **Memory Agent**   | VECNA memory, context retrieval, learning     | "Remember that I prefer dark mode in all apps"       |
| **Creative Agent** | Writing, content generation, design           | "Draft a blog post about AI assistants"              |

### Pillar 5: Unlimited Skills & Self-Improvement

| Aspect                        | Detail                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------- |
| **Skill marketplace**         | Community and built-in skills (Python packages with `SKILL.md` manifest)         |
| **Install on demand**         | "Jarvis, learn how to control Philips Hue lights" → downloads skill + configures |
| **Self-improvement**          | Jarvis can browse documentation, GitHub repos, forums to learn new capabilities  |
| **Capability sandbox**        | Every skill runs in a sandboxed environment with explicit permissions            |
| **No hardcoded integrations** | All integrations via skills; Jarvis core knows nothing about Hue/Tesla/Slack     |

### Pillar 6: Local-First, Privacy-First

| Aspect                   | Detail                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| **Local processing**     | Wake word, STT (small model), TTS, agent inference all run locally  |
| **No cloud required**    | Works fully offline; optional cloud for heavy models (user choice)  |
| **Your data stays home** | No telemetry, no analytics, no cloud storage of conversations       |
| **Encrypted Vault**      | Secrets, API keys, credentials stored in hardware-backed encryption |
| **Audit trail**          | Every action logged locally for your review; no external sharing    |

---

## 3. Architecture: The Jarvis Hub

```
┌─────────────────────────────────────────┐
│         JARVIS HUB (Mini PC)            │
│                                         │
│  ┌──────────────┐   ┌──────────────┐   │
│  │  Wake Word   │   │   Electron   │   │
│  │   Engine     │   │  Dashboard   │   │
│  │  (local)     │   │  (monitor)   │   │
│  └──────┬───────┘   └──────────────┘   │
│         │                               │
│  ┌──────▼──────────────────────┐        │
│  │     JARVIS ORCHESTRATOR     │        │
│  │   (voice · context · TTS)   │        │
│  └──────┬──────────────┬──────┘        │
│         │              │                │
│  ┌──────▼──┐  ┌───────▼───┐           │
│  │  Agent  │  │  Agent    │ ...         │
│  │  Pool   │  │  Pool     │             │
│  │  (async)│  │  (async)  │             │
│  └────┬────┘  └─────┬─────┘             │
│       │             │                   │
│  ┌────▼─────────────▼────┐             │
│  │    STATE (SQLite)      │             │
│  │  · sessions           │             │
│  │  · memory (VECNA)     │             │
│  │  · audit chain         │             │
│  │  · skills registry     │             │
│  └───────────────────────┘             │
│                                         │
│  ┌──────────────────────┐              │
│  │  Monitor Controller  │              │
│  │  · open apps         │              │
│  │  · switch windows    │              │
│  │  · display results   │              │
│  └──────────────────────┘              │
└─────────────────────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│Monitor│  │Monitor│  │Speakers│
│  1    │  │  2    │  │        │
└───────┘  └───────┘  └────────┘
```

### 3.1 Runtime Flow

```
User: "Jarvis, provide me latest updates"

1. Wake word detected → audio stream starts
2. STT (local Whisper-small): "provide me latest updates"
3. Jarvis Orchestrator:
   a. Parses intent: "get_updates"
   b. Checks context: "updates about what?" (if ambiguous, asks)
   c. Delegates to relevant agents:
      - System Agent: check calendar for today
      - Comm Agent: check unread messages
      - Research Agent: check news (if user configured)
4. Agents work in parallel (if independent)
5. Jarvis synthesizes:
   "You have a standup in 30 minutes. Your Q3 report is due Friday.
    Would you like me to open the project folder?"
6. TTS speaks response
7. Monitor Controller: opens calendar app on Monitor 1
```

---

## 4. Package Alignment

| Package                 | Responsibility                                                                          | Vision Alignment                    |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------------------------- |
| `@openhawkins/core`     | Agent loop, grounding, tools, capabilities                                              | Foundation for all agents           |
| `@openhawkins/jarvis`   | **NEW** — Wake word, STT, TTS, orchestrator, monitor controller                         | The Jarvis hub itself               |
| `@openhawkins/agents`   | **NEW** — Specialist agent definitions (research, system, code, vision, comm, creative) | Agent pool that Jarvis delegates to |
| `@openhawkins/state`    | SQLite sessions, audit, skill registry                                                  | Persistent state for the hub        |
| `@openhawkins/memory`   | VECNA — context, preferences, learned behaviors                                         | Jarvis remembers everything         |
| `@openhawkins/skills`   | **NEW** — Skill marketplace, installer, sandbox, `SKILL.md` loader                      | Unlimited extensibility             |
| `@openhawkins/sync`     | Device sync (future: phone companion app)                                               | Multi-device support                |
| `@openhawkins/desktop`  | Electron dashboard (monitor display)                                                    | Visual interface                    |
| `@openhawkins/security` | Vault, audit, capabilities, redaction, taint                                            | Zero trust, always                  |

---

## 5. What Changed from Previous Vision

| Before (Track B)                        | Now (Jarvis Hub)                                               |
| --------------------------------------- | -------------------------------------------------------------- |
| Multi-device sync (phone + laptop + PC) | **Single dedicated hub** (mini PC) — sync is secondary         |
| Generic personal assistant              | **Named, voice-first AI** with personality                     |
| User interacts with apps directly       | **Jarvis is the single interface** — user never touches agents |
| Passive (waits for user)                | **Proactive** — can initiate based on schedule/events          |
| Visual via Flutter mobile app           | **Visual via attached monitors** + Electron dashboard          |
| Skills are future/plugin                | **Skills are core** — Jarvis learns and installs on demand     |

---

## 6. Non-Goals (for v1)

- **No mobile app** — v1 is hub-only; phone companion comes later
- **No cloud processing** — all inference local (ollama/localai); optional cloud bridge for heavy models
- **No multi-user** — one Jarvis per household; family mode is v2
- **No robotics** — no physical actuators (arms, wheels); software-only
- **No general web browsing** — agents can browse for tasks, but Jarvis doesn't "surf the web" for fun

---

## 7. Canonical References

- **Main design spec:** [`docs/specs/2026-06-05-openhawkins-design.md`](specs/2026-06-05-openhawkins-design.md)
- **Track B spec:** [`docs/specs/2026-06-10-track-b-personal-assistant.md`](specs/2026-06-10-track-b-personal-assistant.md) (now "sync" feature, not core)
- **Security model:** [`docs/security-model.md`](security-model.md)
- **Production-readiness review:** [`docs/reviews/2026-06-09-production-readiness-review.md`](reviews/2026-06-09-production-readiness-review.md)

---

_This document is the single source of truth. All code, design, and implementation must align with it. When in doubt, ask: "Does this make Jarvis better at serving the user?"_
