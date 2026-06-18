import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@openjarvis/state";
import { SqlCronStore } from "../src/store.js";
import type { CronJob } from "../src/types.js";

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "test-job",
    cron: overrides.cron ?? "0 9 * * *",
    intent: overrides.intent ?? "test-intent",
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...(overrides.params !== undefined ? { params: overrides.params } : {}),
    ...(overrides.lastRun !== undefined ? { lastRun: overrides.lastRun } : {}),
    ...(overrides.nextRun !== undefined ? { nextRun: overrides.nextRun } : {}),
  };
}

describe("SqlCronStore", () => {
  let store: SqlCronStore;

  beforeEach(() => {
    const db = openDatabase({ path: ":memory:" });
    store = new SqlCronStore(db);
  });

  it("saves and loads a job", () => {
    const job = makeJob();
    store.save(job);
    const loaded = store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: job.id,
      name: job.name,
      cron: job.cron,
      intent: job.intent,
      enabled: job.enabled,
      createdAt: job.createdAt,
    });
  });

  it("saves and loads a job with params", () => {
    const job = makeJob({ params: { key: "value", num: 42 } });
    store.save(job);
    const loaded = store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].params).toEqual({ key: "value", num: 42 });
  });

  it("updates a job", () => {
    const job = makeJob();
    store.save(job);
    const updated = { ...job, lastRun: "2025-01-01T00:00:00.000Z" };
    store.update(updated);
    const loaded = store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].lastRun).toBe("2025-01-01T00:00:00.000Z");
  });

  it("removes a job", () => {
    const job = makeJob();
    store.save(job);
    const result = store.remove(job.id);
    expect(result).toBe(true);
    expect(store.loadAll()).toHaveLength(0);
  });

  it("returns false when removing non-existent job", () => {
    const result = store.remove("nonexistent");
    expect(result).toBe(false);
  });
});
