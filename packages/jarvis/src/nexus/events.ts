import type { Intent, DispatchPlan, AgentRoute, AgentResult, Synthesis } from "./types.js";

export type PulsePhase = "await_input" | "parse_intent" | "route_dispatch" | "synthesize_output" | "await_feedback";

export interface IntentRoutedEvent {
  type: "intent_routed";
  intent: Intent;
  plan: DispatchPlan;
  sessionId: string;
  at: number;
}

export interface AgentDispatchedEvent {
  type: "agent_dispatched";
  agentId: string;
  route: AgentRoute;
  sessionId: string;
  at: number;
}

export interface AgentCompletedEvent {
  type: "agent_completed";
  agentId: string;
  result: AgentResult;
  durationMs: number;
  sessionId: string;
  at: number;
}

export interface AgentFailedEvent {
  type: "agent_failed";
  agentId: string;
  error: string;
  sessionId: string;
  at: number;
}

export interface AgentTimeoutEvent {
  type: "agent_timeout";
  agentId: string;
  timeoutMs: number;
  sessionId: string;
  at: number;
}

export interface ResultsCollectedEvent {
  type: "results_collected";
  results: AgentResult[];
  failed: string[];
  sessionId: string;
  at: number;
}

export interface SynthesisCompleteEvent {
  type: "synthesis_complete";
  synthesis: Synthesis;
  sessionId: string;
  at: number;
}

export interface TaskStartedEvent {
  type: "task_started";
  taskId: string;
  agentId: string;
  description: string;
  sessionId: string;
  at: number;
}

export interface TaskCompletedEvent {
  type: "task_completed";
  taskId: string;
  agentId: string;
  success: boolean;
  sessionId: string;
  at: number;
}

export interface PulsePhaseChangedEvent {
  type: "pulse_phase_changed";
  from: PulsePhase;
  to: PulsePhase;
  sessionId: string;
  at: number;
}

export interface SessionContextLoadedEvent {
  type: "session_context_loaded";
  memoryFragments: number;
  sessionId: string;
  at: number;
}

export type NexusEvent =
  | IntentRoutedEvent
  | AgentDispatchedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | AgentTimeoutEvent
  | ResultsCollectedEvent
  | SynthesisCompleteEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | PulsePhaseChangedEvent
  | SessionContextLoadedEvent;
