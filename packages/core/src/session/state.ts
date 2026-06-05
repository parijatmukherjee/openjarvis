import type { DomainEvent } from "./events.js";

export interface TurnState {
  id: string;
  input: string;
  final?: string;
}

export interface SessionState {
  agentId?: string;
  turns: TurnState[];
}

export function initialState(): SessionState {
  return { turns: [] };
}

export function reduceEvent(state: SessionState, event: DomainEvent): SessionState {
  switch (event.type) {
    case "SessionStarted":
      return { ...state, agentId: event.agentId };
    case "TurnStarted":
      return { ...state, turns: [...state.turns, { id: event.turnId, input: event.input }] };
    case "TurnEnded":
      return {
        ...state,
        turns: state.turns.map((t) => (t.id === event.turnId ? { ...t, final: event.final } : t)),
      };
  }
}

export function foldEvents(events: readonly DomainEvent[]): SessionState {
  return events.reduce(reduceEvent, initialState());
}
