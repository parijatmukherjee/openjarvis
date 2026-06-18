import type { SqlDriver } from "@openjarvis/state";
import type { CronJob } from "./types.js";

export interface CronPersistence {
  save(job: CronJob): void;
  update(job: CronJob): void;
  remove(id: string): boolean;
  loadAll(): CronJob[];
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron TEXT NOT NULL,
  intent TEXT NOT NULL,
  params TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  lastRun TEXT,
  nextRun TEXT,
  createdAt TEXT NOT NULL
)`;

export class SqlCronStore implements CronPersistence {
  private driver: SqlDriver;
  private stmtSave;
  private stmtUpdate;
  private stmtRemove;
  private stmtLoadAll;

  constructor(driver: SqlDriver) {
    this.driver = driver;
    this.driver.exec(CREATE_TABLE);
    this.stmtSave = this.driver.prepare(
      "INSERT INTO cron_jobs (id, name, cron, intent, params, enabled, lastRun, nextRun, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    this.stmtUpdate = this.driver.prepare(
      "UPDATE cron_jobs SET name = ?, cron = ?, intent = ?, params = ?, enabled = ?, lastRun = ?, nextRun = ?, createdAt = ? WHERE id = ?",
    );
    this.stmtRemove = this.driver.prepare("DELETE FROM cron_jobs WHERE id = ?");
    this.stmtLoadAll = this.driver.prepare("SELECT * FROM cron_jobs");
  }

  save(job: CronJob): void {
    this.stmtSave.run(
      job.id,
      job.name,
      job.cron,
      job.intent,
      job.params !== undefined ? JSON.stringify(job.params) : null,
      job.enabled ? 1 : 0,
      job.lastRun ?? null,
      job.nextRun ?? null,
      job.createdAt,
    );
  }

  update(job: CronJob): void {
    this.stmtUpdate.run(
      job.name,
      job.cron,
      job.intent,
      job.params !== undefined ? JSON.stringify(job.params) : null,
      job.enabled ? 1 : 0,
      job.lastRun ?? null,
      job.nextRun ?? null,
      job.createdAt,
      job.id,
    );
  }

  remove(id: string): boolean {
    const result = this.stmtRemove.run(id);
    return result.changes > 0;
  }

  loadAll(): CronJob[] {
    const rows = this.stmtLoadAll.all() as Record<string, unknown>[];
    const jobs: CronJob[] = [];
    for (const row of rows) {
      try {
        const job: CronJob = {
          id: row.id as string,
          name: row.name as string,
          cron: row.cron as string,
          intent: row.intent as string,
          enabled: (row.enabled as number) === 1,
          createdAt: row.createdAt as string,
        };
        if (row.params !== null) {
          job.params = JSON.parse(row.params as string) as Record<string, unknown>;
        }
        if (row.lastRun !== null) {
          job.lastRun = row.lastRun as string;
        }
        if (row.nextRun !== null) {
          job.nextRun = row.nextRun as string;
        }
        jobs.push(job);
      } catch {
        void 0;
      }
    }
    return jobs;
  }
}
