import type { Intent } from "./intent.js";

export interface Scheduler {
  schedule(job: ScheduledJob): Promise<string>;
  cancel(jobId: string): Promise<void>;
  list(): Promise<ScheduledJob[]>;
}

export interface ScheduledJob {
  id?: string;
  name: string;
  cron: string;
  intent: Intent;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}
