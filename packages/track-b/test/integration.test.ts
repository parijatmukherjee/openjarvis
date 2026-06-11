import { describe, it, expect, beforeEach } from "vitest";
import {
  createDeviceInfo,
  registerDevice,
  approveDevice,
  generateKeypair,
  generatePairingToken,
  verifyPairingToken,
  createFragment,
  resolveConflict,
  performNoiseHandshake,
  routeTask,
  deriveSyncMasterKey,
  storeVaultEntry,
  getVaultEntry,
  clearRegistry,
  clearFragmentStore,
  clearVaultStore,
} from "../src/index.js";

describe("Track B Integration", () => {
  beforeEach(() => {
    clearRegistry();
    clearFragmentStore();
    clearVaultStore();
  });

  it("full device lifecycle: create, pair, approve, sync", () => {
    // 1. Create two devices
    const macKey = generateKeypair();
    const mac = createDeviceInfo(
      "MacBook",
      "laptop",
      Buffer.from(macKey.publicKey).toString("hex"),
    );
    registerDevice(mac);

    const phoneKey = generateKeypair();
    const phone = createDeviceInfo(
      "iPhone",
      "mobile",
      Buffer.from(phoneKey.publicKey).toString("hex"),
    );
    registerDevice(phone);

    // 2. Generate pairing token
    const { token, expiresAt } = generatePairingToken();
    expect(verifyPairingToken(token, token, expiresAt)).toBe(true);

    // 3. Approve
    const approved = approveDevice(phone.deviceId, mac.deviceId);
    expect(approved?.approvedAt).toBeGreaterThan(0);

    // 4. Create a memory fragment
    const fragment = createFragment("Hello world", mac.deviceId);
    expect(fragment.vectorClock).toEqual({ [mac.deviceId]: 1 });

    // 5. Sync via conflict resolution
    const phoneFragment = createFragment("Hi there", phone.deviceId);
    const winner = resolveConflict(fragment, phoneFragment);
    expect(winner.fragmentId).toBeDefined();

    // 6. Noise handshake
    const cipher = performNoiseHandshake(macKey, phoneKey.publicKey);
    const data = new TextEncoder().encode("sync");
    expect(cipher.decrypt(cipher.encrypt(data))).toEqual(data);

    // 7. Route a task
    const target = routeTask(
      {
        id: "t1",
        description: "shell task",
        requiredTools: ["shell"],
        computeEstimate: "high",
        estimatedDuration: 1000,
      },
      [
        {
          deviceId: mac.deviceId,
          deviceType: mac.deviceType,
          online: true,
          capabilities: { compute: "high", storage: "full", network: "wifi", tools: ["shell"] },
        },
        {
          deviceId: phone.deviceId,
          deviceType: phone.deviceType,
          online: true,
          capabilities: {
            compute: "low",
            storage: "limited",
            network: "cellular",
            tools: ["shell"],
          },
        },
      ],
    );
    expect(target?.deviceId).toBe(mac.deviceId); // prefers desktop for high compute

    // 8. Vault sync
    deriveSyncMasterKey("secret-passphrase");
    storeVaultEntry({ key: "api-key", value: "12345", vectorClock: { [mac.deviceId]: 1 } });
    const entry = getVaultEntry("api-key");
    expect(entry?.value).toBe("12345");
  });
});
