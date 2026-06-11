export interface SyncedEvent {
  deviceSeq: number;
  localSeq: number;
  deviceId: string;
  sessionId: string;
  type: string;
  payload: string;
  at: number;
}

const eventStore: SyncedEvent[] = [];
const syncState: Map<string, number> = new Map();

export function storeEvent(event: SyncedEvent): void {
  eventStore.push(event);
}

export function getDelta(deviceId: string, lastSyncedSeq: number): SyncedEvent[] {
  return eventStore.filter((e) => e.deviceId === deviceId && e.deviceSeq > lastSyncedSeq);
}

export function getAllEventsAfter(seq: number): SyncedEvent[] {
  return eventStore.filter((e) => e.deviceSeq > seq).sort((a, b) => a.deviceSeq - b.deviceSeq);
}

export function applyDelta(events: SyncedEvent[]): { inserted: number; deduped: number } {
  let inserted = 0;
  let deduped = 0;
  for (const event of events) {
    const exists = eventStore.some(
      (e) => e.deviceSeq === event.deviceSeq && e.deviceId === event.deviceId,
    );
    if (!exists) {
      eventStore.push(event);
      inserted++;
    } else {
      deduped++;
    }
  }
  return { inserted, deduped };
}

export function getLastSeq(deviceId: string): number {
  return syncState.get(deviceId) ?? 0;
}

export function updateSyncState(deviceId: string, seq: number): void {
  syncState.set(deviceId, Math.max(syncState.get(deviceId) ?? 0, seq));
}

export function clearEventStore(): void {
  eventStore.length = 0;
  syncState.clear();
}
