import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphOAuth } from "../../src/graph/oauth.js";
import type { Vault } from "@openjarvis/core";

function createMockVault(): Vault {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

const config = { clientId: "test-client-id", tenant: "common" };

describe("GraphOAuth", () => {
  let vault: Vault;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vault = createMockVault();
    mockFetch = vi.fn();
  });

  describe("startDeviceCodeAuth", () => {
    it("calls device code endpoint and returns DeviceCodeInfo", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: "dc-123",
          user_code: "ABCD-1234",
          verification_uri: "https://microsoft.com/devicelogin",
          expires_in: 900,
          interval: 5,
        }),
      });

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const result = await oauth.startDeviceCodeAuth();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(result).toEqual({
        deviceCode: "dc-123",
        userCode: "ABCD-1234",
        verificationUrl: "https://microsoft.com/devicelogin",
        expiresIn: 900,
        interval: 5,
      });
    });
  });

  describe("waitForAuth", () => {
    it("polls token endpoint and stores tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const result = await oauth.waitForAuth("dc-123");

      expect(result.success).toBe(true);
      expect(vault.set).toHaveBeenCalledWith("graph:access-token", "at-123");
      expect(vault.set).toHaveBeenCalledWith("graph:refresh-token", "rt-456");
    });

    it("returns error on authorization_pending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "authorization_pending",
          error_description: "Authorization pending",
        }),
      });

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const result = await oauth.waitForAuth("dc-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("authorization_pending");
    });
  });

  describe("refreshToken", () => {
    it("uses refresh_token from vault", async () => {
      await vault.set("graph:refresh-token", "rt-existing");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at-new",
          refresh_token: "rt-new",
          expires_in: 3600,
        }),
      });

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const result = await oauth.refreshToken();

      expect(result.success).toBe(true);
      expect(vault.set).toHaveBeenCalledWith("graph:access-token", "at-new");
      expect(vault.set).toHaveBeenCalledWith("graph:refresh-token", "rt-new");

      const callBody = new URLSearchParams((mockFetch.mock.calls[0] as any)[1].body as string);
      expect(callBody.get("refresh_token")).toBe("rt-existing");
    });

    it("returns error when no refresh token stored", async () => {
      const oauth = new GraphOAuth(config, vault, mockFetch);
      const result = await oauth.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain("No refresh token");
    });
  });

  describe("getAccessToken", () => {
    it("returns stored token if not expired", async () => {
      const future = Date.now() + 600_000;
      await vault.set("graph:access-token", "at-valid");
      await vault.set("graph:token-expires", String(future));

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const token = await oauth.getAccessToken();

      expect(token).toBe("at-valid");
    });

    it("refreshes when token is near expiry", async () => {
      const nearExpiry = Date.now() + 200_000;
      await vault.set("graph:access-token", "at-old");
      await vault.set("graph:refresh-token", "rt-old");
      await vault.set("graph:token-expires", String(nearExpiry));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at-refreshed",
          refresh_token: "rt-refreshed",
          expires_in: 3600,
        }),
      });

      const oauth = new GraphOAuth(config, vault, mockFetch);
      const token = await oauth.getAccessToken();

      expect(token).toBe("at-refreshed");
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
