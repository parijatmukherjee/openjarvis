export interface CronJob {
  id: string;
  name: string;
  cron: string;
  intent: string;
  params?: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface CronJobCreate {
  name: string;
  cron: string;
  intent: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
}