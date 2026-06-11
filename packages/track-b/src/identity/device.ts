import { randomUUID } from "node:crypto";

export type DeviceType = "desktop" | "laptop" | "mobile" | "tablet" | "server";

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  publicKey: string; // hex-encoded Ed25519 public key
  approvedAt: number | null;
  approvedBy: string | null;
  lastSeenAt: number;
  vectorClock: Record<string, number>;
}

export function createDeviceInfo(
  deviceName: string,
  deviceType: DeviceType,
  publicKey: string,
): DeviceInfo {
  return {
    deviceId: randomUUID(),
    deviceName,
    deviceType,
    publicKey,
    approvedAt: null,
    approvedBy: null,
    lastSeenAt: Date.now(),
    vectorClock: {},
  };
}
