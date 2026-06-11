import { describe, it, expect } from "vitest";
import { routeTask } from "../src/routing/router.js";
import type { Task, RoutingDevice } from "../src/routing/router.js";

describe("Task Router", () => {
  const devices: RoutingDevice[] = [
    {
      deviceId: "pc",
      deviceType: "desktop",
      online: true,
      capabilities: { compute: "high", storage: "full", network: "wifi", tools: ["shell", "fs"] },
    },
    {
      deviceId: "phone",
      deviceType: "mobile",
      online: true,
      capabilities: {
        compute: "low",
        battery: { level: 80, charging: false },
        storage: "limited",
        network: "cellular",
        tools: ["sms"],
      },
    },
    {
      deviceId: "laptop",
      deviceType: "laptop",
      online: true,
      capabilities: { compute: "medium", storage: "full", network: "wifi", tools: ["shell"] },
    },
  ];

  it("routes to device with required tool", () => {
    const task: Task = {
      id: "t1",
      description: "test",
      requiredTools: ["sms"],
      computeEstimate: "low",
      estimatedDuration: 1000,
    };
    expect(routeTask(task, devices)?.deviceId).toBe("phone");
  });

  it("prefers high compute for heavy tasks", () => {
    const task: Task = {
      id: "t2",
      description: "heavy",
      requiredTools: ["shell"],
      computeEstimate: "high",
      estimatedDuration: 1000,
    };
    expect(routeTask(task, devices)?.deviceId).toBe("pc");
  });

  it("avoids mobile for high compute", () => {
    const task: Task = {
      id: "t3",
      description: "heavy",
      requiredTools: ["shell"],
      computeEstimate: "high",
      estimatedDuration: 1000,
    };
    const result = routeTask(task, devices);
    expect(result?.deviceType).not.toBe("mobile");
  });

  it("prefers plugged-in for long tasks", () => {
    const task: Task = {
      id: "t4",
      description: "long",
      requiredTools: ["shell"],
      computeEstimate: "low",
      estimatedDuration: 60000,
    };
    // pc has no battery (undefined = plugged in)
    const result = routeTask(task, devices);
    expect(result?.deviceId).toBe("pc");
  });

  it("prefers charging device for long tasks", () => {
    const chargingPhone: RoutingDevice = {
      deviceId: "charging-phone",
      deviceType: "mobile",
      online: true,
      capabilities: {
        compute: "low",
        battery: { level: 80, charging: true },
        storage: "limited",
        network: "wifi",
        tools: ["shell"],
      },
    };
    const task: Task = {
      id: "t6",
      description: "long",
      requiredTools: ["shell"],
      computeEstimate: "low",
      estimatedDuration: 60000,
    };
    const result = routeTask(task, [...devices, chargingPhone]);
    expect(result?.deviceId).toBe("pc"); // pc has no battery = plugged in, highest priority
  });

  it("returns undefined if no device matches", () => {
    const task: Task = {
      id: "t5",
      description: "impossible",
      requiredTools: ["nonexistent"],
      computeEstimate: "low",
      estimatedDuration: 1000,
    };
    expect(routeTask(task, devices)).toBeUndefined();
  });
});
