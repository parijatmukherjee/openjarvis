import { describe, it, expect } from "vitest";
import {
  generatePairingToken,
  verifyPairingToken,
  buildQRPayload,
} from "../src/identity/pairing.js";

describe("Pairing", () => {
  it("generates a 96-char hex token", () => {
    const { token } = generatePairingToken();
    expect(token).toMatch(/^[0-9a-f]{96}$/);
  });

  it("expires in 5 minutes", () => {
    const { expiresAt } = generatePairingToken();
    expect(expiresAt - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it("verifies correct token", () => {
    const { token, expiresAt } = generatePairingToken();
    expect(verifyPairingToken(token, token, expiresAt)).toBe(true);
  });

  it("rejects expired token", () => {
    expect(verifyPairingToken("abc", "abc", Date.now() - 1)).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(verifyPairingToken("abc", "def", Date.now() + 10000)).toBe(false);
  });

  it("builds QR payload", () => {
    const payload = buildQRPayload("tok", "pkpkpk", "MyWiFi");
    const parsed = JSON.parse(payload);
    expect(parsed.t).toBe("tok");
    expect(parsed.pk).toBe("pkpkpk"); // first 32 chars of pk (but pk is only 6 chars here)
    expect(parsed.ssid).toBe("MyWiFi");
  });
});
