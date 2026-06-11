import { describe, it, expect, beforeEach } from "vitest";
import {
  storeEvent,
  getDelta,
  getAllEventsAfter,
  applyDelta,
  getLastSeq,
  updateSyncState,
  clearEventStore,
} from "../src/crdt/event-sync.js";

describe("Event Sync", () => {
  beforeEach(() => {
    clearEventStore();
  });

  it("stores and retrieves events", () => {
    const ev = {
      deviceSeq: 1,
      localSeq: 1,
      deviceId: "d1",
      sessionId: "s1",
      type: "test",
      payload: "{}",
      at: Date.now(),
    };
    storeEvent(ev);
    expect(getDelta("d1", 0)).toHaveLength(1);
  });

  it("applies delta with dedup", () => {
    const ev = {
      deviceSeq: 1,
      localSeq: 1,
      deviceId: "d1",
      sessionId: "s1",
      type: "test",
      payload: "{}",
      at: Date.now(),
    };
    storeEvent(ev);
    const result = applyDelta([ev]);
    expect(result.inserted).toBe(0);
    expect(result.deduped).toBe(1);
  });

  it("gets all events after a seq", () => {
    storeEvent({
      deviceSeq: 1,
      localSeq: 1,
      deviceId: "d1",
      sessionId: "s1",
      type: "test",
      payload: "{}",
      at: 1,
    });
    storeEvent({
      deviceSeq: 2,
      localSeq: 2,
      deviceId: "d2",
      sessionId: "s1",
      type: "test",
      payload: "{}",
      at: 2,
    });
    expect(getAllEventsAfter(0)).toHaveLength(2);
    expect(getAllEventsAfter(1)).toHaveLength(1);
  });

  it("applies delta inserting new events", () => {
    const ev = {
      deviceSeq: 1,
      localSeq: 1,
      deviceId: "d1",
      sessionId: "s1",
      type: "test",
      payload: "{}",
      at: 1,
    };
    const result = applyDelta([ev]);
    expect(result.inserted).toBe(1);
    expect(result.deduped).toBe(0);
  });

  it("tracks sync state for unknown device", () => {
    expect(getLastSeq("unknown")).toBe(0);
    updateSyncState("d1", 5);
    expect(getLastSeq("d1")).toBe(5);
    updateSyncState("d1", 3); // should not go backwards
    expect(getLastSeq("d1")).toBe(5);
  });
});
