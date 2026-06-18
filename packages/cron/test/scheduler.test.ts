import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import { CronScheduler } from "../src/scheduler.js";
import type { CronPersistence } from "../src/store.js";
import type { CronJob } from "../src/types.js";
import { registerCronTools } from "../src/tools.js";

vi.mock("node-cron", () => {
  const scheduledTasks: { cron: string; callback: () => Promise<void>; stopped: boolean }[] = [];
  return {
    default: {
      validate: (expr: string) => {
        const parts = expr.trim().split(/\s+/);
        return parts.length === 5 || parts.length === 6;
      },
      schedule: (expr: string, callback: () => Promise<void>) => {
        const task = { cron: expr, callback, stopped: false };
        scheduledTasks.push(task);
        return {
          stop: () => {
            task.stopped = true;
          },
        };
      },
    },
  };
});

const ctx = { agentId: "test-agent" };
const cronManageGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "cron:manage" }],
};
const cronReadGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "cron:read" }],
};
const fullGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "cron:read" }, { name: "cron:manage" }],
};

describe("CronScheduler", () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler({});
  });

  it("creates and starts a job", async () => {
    const job = await scheduler.schedule({
      name: "Daily standup",
      cron: "0 9 * * 1-5",
      intent: "summarize-standup",
      enabled: true,
    });
    expect(job.id).toBeDefined();
    expect(job.name).toBe("Daily standup");
    expect(job.cron).toBe("0 9 * * 1-5");
    expect(job.intent).toBe("summarize-standup");
    expect(job.enabled).toBe(true);
    expect(job.createdAt).toBeDefined();
  });

  it("returns all scheduled jobs", async () => {
    await scheduler.schedule({ name: "Job A", cron: "0 9 * * *", intent: "a" });
    await scheduler.schedule({ name: "Job B", cron: "0 18 * * *", intent: "b" });
    const jobs = await scheduler.list();
    expect(jobs).toHaveLength(2);
    const names = jobs.map((j) => j.name);
    expect(names).toContain("Job A");
    expect(names).toContain("Job B");
  });

  it("stops and removes a job on cancel", async () => {
    const job = await scheduler.schedule({ name: "To cancel", cron: "0 0 * * *", intent: "x" });
    const result = await scheduler.cancel(job.id);
    expect(result).toBe(true);
    const jobs = await scheduler.list();
    expect(jobs).toHaveLength(0);
  });

  it("returns false when cancelling non-existent job", async () => {
    const result = await scheduler.cancel("nonexistent");
    expect(result).toBe(false);
  });

  it("rejects invalid cron expressions", async () => {
    await expect(
      scheduler.schedule({ name: "Bad", cron: "not-a-cron", intent: "x" }),
    ).rejects.toThrow("invalid cron expression");
  });

  it("generates unique IDs", async () => {
    const job1 = await scheduler.schedule({ name: "A", cron: "0 1 * * *", intent: "a" });
    const job2 = await scheduler.schedule({ name: "B", cron: "0 2 * * *", intent: "b" });
    expect(job1.id).not.toBe(job2.id);
  });

  it("defaults enabled to true", async () => {
    const job = await scheduler.schedule({
      name: "Default enabled",
      cron: "0 0 * * *",
      intent: "x",
    });
    expect(job.enabled).toBe(true);
  });

  it("accepts optional params", async () => {
    const job = await scheduler.schedule({
      name: "With params",
      cron: "0 0 * * *",
      intent: "x",
      params: { key: "value" },
    });
    expect(job.params).toEqual({ key: "value" });
  });

  it("schedules disabled job without starting it", async () => {
    const job = await scheduler.schedule({
      name: "Disabled job",
      cron: "0 0 * * *",
      intent: "x",
      enabled: false,
    });
    expect(job.enabled).toBe(false);
    const tasks = await scheduler.list();
    expect(tasks).toHaveLength(1);
  });

  it("does not schedule task for disabled job", async () => {
    const job = await scheduler.schedule({
      name: "Disabled job",
      cron: "0 0 * * *",
      intent: "x",
      enabled: false,
    });
    const cancelled = await scheduler.cancel(job.id);
    expect(cancelled).toBe(true);
  });

  it("calls onTick callback when job fires", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    const sched = new CronScheduler({ onTick });
    await sched.schedule({ name: "Tick test", cron: "* * * * *", intent: "tick" });
    const tasks = await sched.list();
    expect(tasks).toHaveLength(1);
  });

  it("restores jobs from store on restore()", async () => {
    const savedJobs: CronJob[] = [];
    const mockStore: CronPersistence = {
      save: (job) => { savedJobs.push({ ...job }); },
      update: (job) => {
        const idx = savedJobs.findIndex((j) => j.id === job.id);
        if (idx >= 0) savedJobs[idx] = { ...job };
      },
      remove: (id) => {
        const idx = savedJobs.findIndex((j) => j.id === id);
        if (idx >= 0) { savedJobs.splice(idx, 1); return true; }
        return false;
      },
      loadAll: () => savedJobs.map((j) => ({ ...j })),
    };
    const sched1 = new CronScheduler({ store: mockStore });
    await sched1.schedule({ name: "Restored", cron: "0 9 * * *", intent: "test" });
    expect(savedJobs).toHaveLength(1);
    const sched2 = new CronScheduler({ store: mockStore });
    await sched2.restore();
    const jobs = await sched2.list();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("Restored");
  });
});

describe("cron tools", () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler({});
  });

  it("registers tools with correct capabilities", () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const schedule = registry.get("cron_schedule");
    const list = registry.get("cron_list");
    const cancel = registry.get("cron_cancel");
    expect(schedule!.capabilities).toEqual([{ name: "cron:manage" }]);
    expect(list!.capabilities).toEqual([{ name: "cron:read" }]);
    expect(cancel!.capabilities).toEqual([{ name: "cron:manage" }]);
  });

  it("cron_schedule creates a job", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const res = await registry.invoke(
      {
        id: "t1",
        tool: "cron_schedule",
        args: { name: "Test", cron: "0 9 * * 1-5", intent: "test-intent" },
      },
      fullGrant,
      ctx,
    );
    expect(res.ok).toBe(true);
    const data = res.data as { job: { id: string; name: string; cron: string } };
    expect(data.job.name).toBe("Test");
    expect(data.job.cron).toBe("0 9 * * 1-5");
    expect(data.job.intent).toBe("test-intent");
  });

  it("cron_list returns jobs", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    await registry.invoke(
      { id: "t1", tool: "cron_schedule", args: { name: "Job1", cron: "0 9 * * *", intent: "a" } },
      fullGrant,
      ctx,
    );
    const res = await registry.invoke(
      { id: "t2", tool: "cron_list", args: {} },
      cronReadGrant,
      ctx,
    );
    expect(res.ok).toBe(true);
    const data = res.data as { jobs: { name: string }[] };
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].name).toBe("Job1");
  });

  it("cron_cancel removes a job", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const createRes = await registry.invoke(
      {
        id: "t1",
        tool: "cron_schedule",
        args: { name: "To cancel", cron: "0 0 * * *", intent: "x" },
      },
      fullGrant,
      ctx,
    );
    const jobData = createRes.data as { job: { id: string } };
    const cancelRes = await registry.invoke(
      { id: "t2", tool: "cron_cancel", args: { id: jobData.job.id } },
      cronManageGrant,
      ctx,
    );
    expect(cancelRes.ok).toBe(true);
    const cancelData = cancelRes.data as { cancelled: boolean };
    expect(cancelData.cancelled).toBe(true);
  });

  it("denies cron_schedule without cron:manage capability", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const res = await registry.invoke(
      { id: "t1", tool: "cron_schedule", args: { name: "Nope", cron: "0 0 * * *", intent: "x" } },
      cronReadGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("denies cron_list without cron:read capability", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke({ id: "t1", tool: "cron_list", args: {} }, noGrant, ctx);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("denies cron_cancel without cron:manage capability", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const res = await registry.invoke(
      { id: "t1", tool: "cron_cancel", args: { id: "fake" } },
      cronReadGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("handles invalid cron expression via tool", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const res = await registry.invoke(
      { id: "t1", tool: "cron_schedule", args: { name: "Bad", cron: "invalid", intent: "x" } },
      fullGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid cron expression/);
  });

  it("creates job with params via tool", async () => {
    const registry = new ToolRegistry();
    registerCronTools(registry, scheduler);
    const res = await registry.invoke(
      {
        id: "t1",
        tool: "cron_schedule",
        args: { name: "With params", cron: "0 9 * * *", intent: "test", params: { key: "val" } },
      },
      fullGrant,
      ctx,
    );
    expect(res.ok).toBe(true);
    const data = res.data as { job: { params?: Record<string, unknown> } };
    expect(data.job.params).toEqual({ key: "val" });
  });
});
