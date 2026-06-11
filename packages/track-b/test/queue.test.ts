import { describe, it, expect, beforeEach } from "vitest";
import {
  queueTask,
  getQueue,
  dequeue,
  findQueuedForDevice,
  clearQueue,
} from "../src/routing/queue.js";
import type { Task } from "../src/routing/router.js";

describe("Task Queue", () => {
  beforeEach(() => {
    clearQueue();
  });

  it("queues a task", () => {
    const task: Task = {
      id: "t1",
      description: "test",
      requiredTools: [],
      computeEstimate: "low",
      estimatedDuration: 1000,
    };
    const item = queueTask(task, "d1");
    expect(item.task.id).toBe("t1");
    expect(item.deviceId).toBe("d1");
    expect(getQueue()).toHaveLength(1);
  });

  it("dequeues a task", () => {
    const task: Task = {
      id: "t1",
      description: "test",
      requiredTools: [],
      computeEstimate: "low",
      estimatedDuration: 1000,
    };
    queueTask(task, "d1");
    const dequeued = dequeue("t1");
    expect(dequeued?.task.id).toBe("t1");
    expect(getQueue()).toHaveLength(0);
  });

  it("finds queued tasks for a device", () => {
    const task: Task = {
      id: "t1",
      description: "test",
      requiredTools: ["d1-shell"],
      computeEstimate: "low",
      estimatedDuration: 1000,
    };
    queueTask(task, "d1");
    expect(findQueuedForDevice("d1")).toHaveLength(1);
    expect(findQueuedForDevice("d2")).toHaveLength(0);
  });

  it("returns undefined for missing dequeue", () => {
    expect(dequeue("missing")).toBeUndefined();
  });
});
