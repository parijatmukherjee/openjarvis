import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { CronJobCreate } from "./types.js";
import type { CronScheduler } from "./scheduler.js";

const CronScheduleArgsSchema = z.object({
  name: z.string(),
  cron: z.string(),
  intent: z.string(),
  params: z.record(z.unknown()).optional(),
});

type CronScheduleArgs = z.infer<typeof CronScheduleArgsSchema>;

const CronScheduleResultSchema = z.object({
  job: z.object({
    id: z.string(),
    name: z.string(),
    cron: z.string(),
    intent: z.string(),
    params: z.record(z.unknown()).optional(),
    enabled: z.boolean(),
    lastRun: z.string().optional(),
    nextRun: z.string().optional(),
    createdAt: z.string(),
  }),
});

type CronScheduleResult = z.infer<typeof CronScheduleResultSchema>;

const CronListArgsSchema = z.object({});

type CronListArgs = z.infer<typeof CronListArgsSchema>;

const CronListResultSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      cron: z.string(),
      intent: z.string(),
      params: z.record(z.unknown()).optional(),
      enabled: z.boolean(),
      lastRun: z.string().optional(),
      nextRun: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
});

type CronListResult = z.infer<typeof CronListResultSchema>;

const CronCancelArgsSchema = z.object({
  id: z.string(),
});

type CronCancelArgs = z.infer<typeof CronCancelArgsSchema>;

const CronCancelResultSchema = z.object({
  cancelled: z.boolean(),
});

type CronCancelResult = z.infer<typeof CronCancelResultSchema>;

export function createCronScheduleTool(
  scheduler: CronScheduler,
): ToolDefinition<CronScheduleArgs, CronScheduleResult> {
  return {
    name: "cron_schedule",
    description: "Create a scheduled cron job",
    args: CronScheduleArgsSchema as unknown as z.ZodType<CronScheduleArgs>,
    result: CronScheduleResultSchema as unknown as z.ZodType<CronScheduleResult>,
    approvalRequired: true,
    capabilities: [{ name: "cron:manage" as const }],
    handler: async (args: CronScheduleArgs): Promise<CronScheduleResult> => {
      const input: CronJobCreate = {
        name: args.name,
        cron: args.cron,
        intent: args.intent,
        enabled: true,
      };
      if (args.params !== undefined) {
        input.params = args.params;
      }
      const job = await scheduler.schedule(input);
      return { job };
    },
  };
}

export function createCronListTool(
  scheduler: CronScheduler,
): ToolDefinition<CronListArgs, CronListResult> {
  return {
    name: "cron_list",
    description: "List all scheduled cron jobs",
    args: CronListArgsSchema as unknown as z.ZodType<CronListArgs>,
    result: CronListResultSchema as unknown as z.ZodType<CronListResult>,
    capabilities: [{ name: "cron:read" as const }],
    handler: async (_args: CronListArgs): Promise<CronListResult> => {
      const jobs = await scheduler.list();
      return { jobs };
    },
  };
}

export function createCronCancelTool(
  scheduler: CronScheduler,
): ToolDefinition<CronCancelArgs, CronCancelResult> {
  return {
    name: "cron_cancel",
    description: "Cancel a scheduled cron job",
    args: CronCancelArgsSchema as unknown as z.ZodType<CronCancelArgs>,
    result: CronCancelResultSchema as unknown as z.ZodType<CronCancelResult>,
    approvalRequired: true,
    capabilities: [{ name: "cron:manage" as const }],
    handler: async (args: CronCancelArgs): Promise<CronCancelResult> => {
      const cancelled = await scheduler.cancel(args.id);
      return { cancelled };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerCronTools(
  registry: { register(tool: AnyToolDefinition): void },
  scheduler: CronScheduler,
): void {
  registry.register(createCronScheduleTool(scheduler));
  registry.register(createCronListTool(scheduler));
  registry.register(createCronCancelTool(scheduler));
}
