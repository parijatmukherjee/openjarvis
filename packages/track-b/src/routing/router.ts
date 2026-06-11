export interface DeviceCapabilities {
  compute: "low" | "medium" | "high";
  battery?: { level: number; charging: boolean };
  storage: "full" | "limited";
  network: "wifi" | "cellular" | "offline";
  tools: string[];
}

export interface Task {
  id: string;
  description: string;
  requiredTools: string[];
  computeEstimate: "low" | "medium" | "high";
  estimatedDuration: number; // ms
}

export interface RoutingDevice {
  deviceId: string;
  deviceType: string;
  online: boolean;
  capabilities: DeviceCapabilities;
}

export function routeTask(task: Task, devices: RoutingDevice[]): RoutingDevice | undefined {
  const candidates = devices.filter(
    (d) => d.online && task.requiredTools.every((t) => d.capabilities.tools.includes(t)),
  );

  if (candidates.length === 0) return undefined;

  // Sort by compute rank (high > medium > low)
  const rank = { low: 1, medium: 2, high: 3 };
  candidates.sort((a, b) => rank[b.capabilities.compute] - rank[a.capabilities.compute]);

  // Avoid mobile for high-compute tasks
  if (task.computeEstimate === "high") {
    const nonMobile = candidates.filter((d) => d.deviceType !== "mobile");
    if (nonMobile.length > 0) return nonMobile[0];
  }

  // Avoid battery-powered for long tasks
  if (task.estimatedDuration > 30000) {
    const pluggedIn = candidates.filter(
      (d) => !d.capabilities.battery || d.capabilities.battery.charging,
    );
    if (pluggedIn.length > 0) return pluggedIn[0];
  }

  return candidates[0];
}
