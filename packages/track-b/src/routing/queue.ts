import type { Task } from "./router.js";

export interface QueuedTask {
  task: Task;
  queuedAt: number;
  deviceId: string; // device that queued it
}

const queue: QueuedTask[] = [];

export function queueTask(task: Task, deviceId: string): QueuedTask {
  const item: QueuedTask = { task, queuedAt: Date.now(), deviceId };
  queue.push(item);
  return item;
}

export function getQueue(): QueuedTask[] {
  return [...queue];
}

export function dequeue(taskId: string): QueuedTask | undefined {
  const idx = queue.findIndex((q) => q.task.id === taskId);
  if (idx >= 0) {
    return queue.splice(idx, 1)[0];
  }
  return undefined;
}

export function findQueuedForDevice(deviceId: string): QueuedTask[] {
  return queue.filter((q) => q.task.requiredTools.some((t) => t.startsWith(deviceId)));
}

export function clearQueue(): void {
  queue.length = 0;
}
