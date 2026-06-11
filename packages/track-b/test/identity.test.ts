import { describe, it, expect, beforeEach } from "vitest";
import { createDeviceInfo } from "../src/identity/device.js";
import {
  registerDevice,
  getDevice,
  approveDevice,
  revokeDevice,
  listDevices,
  listApprovedDevices,
  clearRegistry,
} from "../src/identity/registry.js";

describe("Device Identity", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("creates a device with UUID and defaults", () => {
    const device = createDeviceInfo("Parijat's MacBook", "laptop", "abcd1234");
    expect(device.deviceId).toBeTruthy();
    expect(device.deviceName).toBe("Parijat's MacBook");
    expect(device.deviceType).toBe("laptop");
    expect(device.publicKey).toBe("abcd1234");
    expect(device.approvedAt).toBeNull();
    expect(device.approvedBy).toBeNull();
    expect(device.lastSeenAt).toBeGreaterThan(0);
    expect(device.vectorClock).toEqual({});
  });

  it("registers and retrieves a device", () => {
    const device = createDeviceInfo("Test Device", "desktop", "pk123");
    registerDevice(device);
    expect(getDevice(device.deviceId)).toEqual(device);
  });

  it("approves a device", () => {
    const d1 = createDeviceInfo("MacBook", "laptop", "pk1");
    const d2 = createDeviceInfo("iPhone", "mobile", "pk2");
    registerDevice(d1);
    registerDevice(d2);
    const approved = approveDevice(d2.deviceId, d1.deviceId);
    expect(approved?.approvedAt).toBeGreaterThan(0);
    expect(approved?.approvedBy).toBe(d1.deviceId);
  });

  it("revokes a device", () => {
    const d1 = createDeviceInfo("MacBook", "laptop", "pk1");
    const d2 = createDeviceInfo("iPhone", "mobile", "pk2");
    registerDevice(d1);
    registerDevice(d2);
    approveDevice(d2.deviceId, d1.deviceId);
    const revoked = revokeDevice(d2.deviceId);
    expect(revoked?.approvedAt).toBeNull();
    expect(revoked?.approvedBy).toBeNull();
  });

  it("handles missing device for approve and revoke", () => {
    expect(approveDevice("missing", "d1")).toBeUndefined();
    expect(revokeDevice("missing")).toBeUndefined();
  });

  it("lists approved devices only", () => {
    const d1 = createDeviceInfo("MacBook", "laptop", "pk1");
    const d2 = createDeviceInfo("iPhone", "mobile", "pk2");
    registerDevice(d1);
    registerDevice(d2);
    approveDevice(d2.deviceId, d1.deviceId);
    expect(listDevices()).toHaveLength(2);
    expect(listApprovedDevices()).toHaveLength(1);
    expect(listApprovedDevices()[0].deviceId).toBe(d2.deviceId);
  });
});
