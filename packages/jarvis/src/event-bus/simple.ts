import type { EventBus, BusEvent, Subscription } from "../event-bus.js";

/**
 * In-memory pub/sub event bus for v1.
 *
 * v1.1: Replace with durable SQLite-backed event bus.
 */
export class SimpleEventBus implements EventBus {
  private handlers = new Map<string, Set<(event: BusEvent) => void>>();

  async publish(event: BusEvent): Promise<void> {
    const handlers = this.handlers.get(event.topic);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  subscribe(topic: string, handler: (event: BusEvent) => void): Subscription {
    let handlers = this.handlers.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(topic, handlers);
    }
    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers?.delete(handler);
      },
    };
  }
}
