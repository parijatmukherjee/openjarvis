import cron from "node-cron";
import type { CronJob, CronJobCreate } from "./types.js";

export type OnTickCallback = (job: CronJob) => Promise<void>;

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private tasks = new Map<string, cron.ScheduledTask>();
  private readonly onTick: OnTickCallback | undefined;

  constructor(onTick?: OnTickCallback) {
    this.onTick = onTick;
  }

  async schedule(input: CronJobCreate): Promise<CronJob> {
    if (!cron.validate(input.cron)) {
      throw new Error(`invalid cron expression: ${input.cron}`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job: CronJob = {
      id,
      name: input.name,
      cron: input.cron,
      intent: input.intent,
      enabled: input.enabled ?? true,
      createdAt: now,
    };
    if (input.params !== undefined) {
      job.params = input.params;
    }

    if (job.enabled) {
      const task = cron.schedule(job.cron, async () => {
        const updated = this.jobs.get(job.id);
        if (!updated) return;
        updated.lastRun = new Date().toISOString();
        if (this.onTick) {
          await this.onTick(updated);
        }
      });
      this.tasks.set(id, task);
    }

    this.jobs.set(id, job);
    return { ...job };
  }

  async list(): Promise<CronJob[]> {
    return Array.from(this.jobs.values()).map((j) => ({ ...j }));
  }

  async cancel(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
    const deleted = this.jobs.delete(id);
    return deleted;
  }
}