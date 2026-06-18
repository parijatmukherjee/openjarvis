import type { Vault } from "@openjarvis/core";
import type { DeviceCodeInfo, AuthResult } from "../types.js";

export interface GraphOAuthConfig {
  clientId: string;
  tenant: string;
}

export class GraphOAuth {
  private config: GraphOAuthConfig;
  private vault: Vault;
  private fetch: typeof globalThis.fetch;
  private scopes = "Mail.Read Mail.ReadWrite Mail.Send offline_access";

  constructor(config: GraphOAuthConfig, vault: Vault, fetchImpl?: typeof globalThis.fetch) {
    this.config = config;
    this.vault = vault;
    this.fetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private get tokenUrl(): string {
    return `https://login.microsoftonline.com/${this.config.tenant}/oauth2/v2.0/token`;
  }

  private get deviceCodeUrl(): string {
    return `https://login.microsoftonline.com/${this.config.tenant}/oauth2/v2.0/devicecode`;
  }

  async startDeviceCodeAuth(): Promise<DeviceCodeInfo> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.scopes,
    });

    const res = await this.fetch(this.deviceCodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const json = (await res.json()) as Record<string, unknown>;
    return {
      deviceCode: json.device_code as string,
      userCode: json.user_code as string,
      verificationUrl: json.verification_uri as string,
      expiresIn: json.expires_in as number,
      interval: json.interval as number,
    };
  }

  async waitForAuth(deviceCode: string): Promise<AuthResult> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
    });

    const res = await this.fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const json = (await res.json()) as Record<string, unknown>;
        message = (json.error_description ?? json.error ?? res.statusText) as string;
      } catch {
        void 0;
      }
      return { success: false, error: message };
    }

    const json = (await res.json()) as Record<string, unknown>;

    const accessToken = json.access_token as string;
    const refreshToken = json.refresh_token as string;
    const expiresIn = json.expires_in as number;

    await this.vault.set("graph:access-token", accessToken);
    await this.vault.set("graph:refresh-token", refreshToken);
    await this.vault.set("graph:token-expires", String(Date.now() + expiresIn * 1000));

    return { success: true };
  }

  async refreshToken(): Promise<AuthResult> {
    const rt = await this.vault.get("graph:refresh-token");
    if (!rt) {
      return { success: false, error: "No refresh token stored" };
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: "refresh_token",
      refresh_token: rt,
      scope: this.scopes,
    });

    const res = await this.fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const json = (await res.json()) as Record<string, unknown>;
        message = (json.error_description ?? json.error ?? res.statusText) as string;
      } catch {
        void 0;
      }
      return { success: false, error: message };
    }

    const json = (await res.json()) as Record<string, unknown>;

    const accessToken = json.access_token as string;
    const newRefreshToken = json.refresh_token as string;
    const expiresIn = json.expires_in as number;

    await this.vault.set("graph:access-token", accessToken);
    await this.vault.set("graph:refresh-token", newRefreshToken);
    await this.vault.set("graph:token-expires", String(Date.now() + expiresIn * 1000));

    return { success: true };
  }

  async getAccessToken(): Promise<string> {
    const token = await this.vault.get("graph:access-token");
    const expiresStr = await this.vault.get("graph:token-expires");

    const fiveMinutes = 5 * 60 * 1000;
    if (token && expiresStr) {
      const expires = Number(expiresStr);
      if (Date.now() < expires - fiveMinutes) {
        return token;
      }
    }

    const result = await this.refreshToken();
    if (!result.success) {
      throw new Error(result.error ?? "Failed to refresh token");
    }

    return (await this.vault.get("graph:access-token")) as string;
  }
}
