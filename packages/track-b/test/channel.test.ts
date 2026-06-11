import { describe, it, expect } from "vitest";
import { EncryptedChannel, type SyncMessage } from "../src/network/channel.js";
import { createMockCipher } from "../src/network/noise.js";

describe("EncryptedChannel", () => {
  it("round-trips a SyncMessage", () => {
    const secret = new Uint8Array(32);
    for (let i = 0; i < 32; i++) secret[i] = i;
    const cipher = createMockCipher(secret);
    const channel = new EncryptedChannel(cipher);

    const msg: SyncMessage = {
      type: "delta",
      fromDevice: "d1",
      vectorClock: { d1: 1 },
      payload: { type: "events", events: [{ x: 1 }] },
    };

    const encrypted = channel.send(msg);
    const decrypted = channel.receive(encrypted);
    expect(decrypted).toEqual(msg);
  });
});
