import { randomBytes } from "node:crypto";

export interface PairingToken {
  token: string;
  expiresAt: number;
}

export function generatePairingToken(): PairingToken {
  const token = randomBytes(48).toString("hex");
  return { token, expiresAt: Date.now() + 5 * 60 * 1000 };
}

export function verifyPairingToken(token: string, expected: string, expiresAt: number): boolean {
  return token === expected && Date.now() < expiresAt;
}

export function buildQRPayload(token: string, publicKey: string, ssidHint: string): string {
  return JSON.stringify({ t: token, pk: publicKey.slice(0, 32), ssid: ssidHint });
}
