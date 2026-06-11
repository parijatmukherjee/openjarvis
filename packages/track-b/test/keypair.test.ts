import { describe, it, expect } from "vitest";
import {
  generateKeypair,
  encodeHex,
  decodeHex,
  signMessage,
  verifySignature,
} from "../src/identity/keypair.js";

describe("Keypair", () => {
  it("generates an Ed25519 keypair", () => {
    const kp = generateKeypair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(64);
  });

  it("round-trips hex encoding", () => {
    const kp = generateKeypair();
    const hex = encodeHex(kp.publicKey);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(decodeHex(hex)).toEqual(kp.publicKey);
  });

  it("signs and verifies a message", () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode("hello world");
    const sig = signMessage(msg, kp.secretKey);
    expect(sig).toBeInstanceOf(Uint8Array);
    expect(verifySignature(msg, sig, kp.publicKey)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode("hello");
    const badSig = new Uint8Array(64); // all zeros
    expect(verifySignature(msg, badSig, kp.publicKey)).toBe(false);
  });
});
