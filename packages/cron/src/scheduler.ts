import cron from "node-cron";
import type { CronJob, CronJobCreate } from "./types.js";
import type { CronPersistence } from "./store.js";

export type OnTickCallback = (job: CronJob) => Promise<void>;

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private tasks = new Map<string, cron.ScheduledTask>();
  private readonly onTick: OnTickCallback | undefined;
  private readonly store: CronPersistence | undefined;

  constructor(opts?: { onTick?: OnTickCallback; store?: CronPersistence }) {
    this.onTick = opts?.onTick;
    this.store = opts?.store;
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
        if (this.store) {
          this.store.update(updated);
        }
        if (this.onTick) {
          await this.onTick(updated);
        }
      });
      this.tasks.set(id, task);
    }

    this.jobs.set(id, job);
    if (this.store) {
      this.store.save(job);
    }
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
    if (deleted && this.store) {
      this.store.remove(id);
    }
    return deleted;
  }

  async restore(): Promise<void> {
    if (!this.store) return;
    const jobs = this.store.loadAll();
    for (const job of jobs) {
      this.jobs.set(job.id, job);
      if (job.enabled) {
        const task = cron.schedule(job.cron, async () => {
          const updated = this.jobs.get(job.id);
          if (!updated) return;
          updated.lastRun = new Date().toISOString();
          if (this.store) {
            this.store.update(updated);
          }
          if (this.onTick) {
            await this.onTick(updated);
          }
        });
        this.tasks.set(job.id, task);
      }
    }
  }
}