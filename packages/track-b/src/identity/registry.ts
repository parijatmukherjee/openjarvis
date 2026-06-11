import type { DeviceInfo } from "./device.js";

const devices: Map<string, DeviceInfo> = new Map();

export function registerDevice(device: DeviceInfo): void {
  devices.set(device.deviceId, device);
}

export function getDevice(deviceId: string): DeviceInfo | undefined {
  return devices.get(deviceId);
}

export function approveDevice(deviceId: string, approvedBy: string): DeviceInfo | undefined {
  const device = devices.get(deviceId);
  if (!device) return undefined;
  device.approvedAt = Date.now();
  device.approvedBy = approvedBy;
  devices.set(deviceId, device);
  return device;
}

export function revokeDevice(deviceId: string): DeviceInfo | undefined {
  const device = devices.get(deviceId);
  if (!device) return undefined;
  device.approvedAt = null;
  device.approvedBy = null;
  devices.set(deviceId, device);
  return device;
}

export function listDevices(): DeviceInfo[] {
  return Array.from(devices.values());
}

export function listApprovedDevices(): DeviceInfo[] {
  return Array.from(devices.values()).filter((d) => d.approvedAt !== null);
}

export function clearRegistry(): void {
  devices.clear();
}
