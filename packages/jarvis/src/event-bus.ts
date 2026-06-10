export interface EventBus {
  publish(event: BusEvent): Promise<void>;
  subscribe(topic: string, handler: (event: BusEvent) => void): Subscription;
}

export interface BusEvent {
  topic: string;
  payload: unknown;
  timestamp: number;
  source: string;
}

export interface Subscription {
  unsubscribe(): void;
}
