import type { PhaseEvent } from "../playbook/events.js";

export type DomainEvent =
  | { type: "SessionStarted"; sessionId: string; agentId: string; at: number; seq?: number }
  | {
      type: "TurnStarted";
      sessionId: string;
      turnId: string;
      input: string;
      at: number;
      seq?: number;
    }
  | {
      type: "TurnEnded";
      sessionId: string;
      turnId: string;
      final: string;
      at: number;
      seq?: number;
    }
  | {
      type: "TurnFailed";
      sessionId: string;
      turnId: string;
      error: string;
      at: number;
      seq?: number;
    }
  | (PhaseEvent & { seq?: number });

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  read(sessionId: string, opts?: { limit?: number; afterSeq?: number }): Promise<DomainEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly log: (DomainEvent & { seq: number })[] = [];
  private nextSeq = 1;

  async append(event: DomainEvent): Promise<void> {
    const stored = { ...event, seq: this.nextSeq++ };
    this.log.push(stored as DomainEvent & { seq: number });
  }

  async read(
    sessionId: string,
    opts?: { limit?: number; afterSeq?: number },
  ): Promise<DomainEvent[]> {
    let events = this.log.filter((e) => e.sessionId === sessionId);
    if (opts?.afterSeq !== undefined) {
      events = events.filter((e) => e.seq > opts.afterSeq!);
    }
    if (opts?.limit !== undefined) {
      events = events.slice(0, opts.limit);
    }
    return events;
  }
}
