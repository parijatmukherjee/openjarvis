import nacl from "tweetnacl";

export interface Keypair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes
}

export function generateKeypair(): Keypair {
  return nacl.sign.keyPair();
}

export function encodeHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function decodeHex(hex: string): Uint8Array {
  const buf = Buffer.from(hex, "hex");
  return new Uint8Array(buf);
}

export function signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return nacl.sign.detached.verify(message, signature, publicKey);
}
