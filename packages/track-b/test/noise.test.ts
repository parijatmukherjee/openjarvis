import { describe, it, expect } from "vitest";
import { performNoiseHandshake, createMockCipher } from "../src/network/noise.js";

describe("Noise Protocol", () => {
  it("performs handshake and encrypts", () => {
    const kp1 = { publicKey: new Uint8Array(32).fill(1), secretKey: new Uint8Array(64).fill(2) };
    const kp2 = { publicKey: new Uint8Array(32).fill(3), secretKey: new Uint8Array(64).fill(4) };

    const cipher1 = performNoiseHandshake(kp1, kp2.publicKey);
    const cipher2 = performNoiseHandshake(kp2, kp1.publicKey);

    const plaintext = new TextEncoder().encode("hello");
    const encrypted = cipher1.encrypt(plaintext);
    const decrypted = cipher2.decrypt(encrypted);

    expect(new TextDecoder().decode(decrypted)).toBe("hello");
  });

  it("mock cipher round-trips", () => {
    const cipher = createMockCipher(new Uint8Array(32).fill(42));
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(cipher.decrypt(cipher.encrypt(data))).toEqual(data);
  });
});
