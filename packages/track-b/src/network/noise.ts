export interface CipherState {
  encrypt: (plaintext: Uint8Array) => Uint8Array;
  decrypt: (ciphertext: Uint8Array) => Uint8Array;
}

export interface NoiseKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function createMockCipher(sharedSecret: Uint8Array): CipherState {
  // Placeholder: XOR "encryption" for testing
  return {
    encrypt: (plaintext: Uint8Array) => {
      const out = new Uint8Array(plaintext.length);
      for (let i = 0; i < plaintext.length; i++) {
        out[i] = plaintext[i] ^ sharedSecret[i % sharedSecret.length];
      }
      return out;
    },
    decrypt: (ciphertext: Uint8Array) => {
      const out = new Uint8Array(ciphertext.length);
      for (let i = 0; i < ciphertext.length; i++) {
        out[i] = ciphertext[i] ^ sharedSecret[i % sharedSecret.length];
      }
      return out;
    },
  };
}

export function performNoiseHandshake(
  localKeypair: NoiseKeypair,
  remotePublicKey: Uint8Array,
): CipherState {
  const sharedSecret = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    sharedSecret[i] = localKeypair.publicKey[i] ^ remotePublicKey[i];
  }
  return createMockCipher(sharedSecret);
}
