import type { Scheduler, ScheduledJob } from "../scheduler.js";

/**
 * In-memory scheduler for v1. Supports listing/cancelling but does NOT
 * actually run cron jobs (no node-cron dependency). Jobs can be fired
 * manually via `trigger(jobId)` for testing.
 *
 * v1.1: Replace with node-cron or bree for real cron scheduling.
 */
export class SimpleScheduler implements Scheduler {
  private jobs = new Map<string, ScheduledJob>();
  private nextId = 1;

  async schedule(job: ScheduledJob): Promise<string> {
    const id = String(this.nextId++);
    const withId: ScheduledJob = { ...job, id };
    this.jobs.set(id, withId);
    return id;
  }

  async cancel(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  async list(): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values());
  }

  /** Manually trigger a job (for testing / proactive simulation). */
  async trigger(jobId: string): Promise<ScheduledJob | undefined> {
    const job = this.jobs.get(jobId);
    return job;
  }
}
