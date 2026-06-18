import { describe, it, expect, vi } from "vitest";
import { resolveSecrets } from "../src/main/resolve-secrets.js";

function createOpClient(responses: Record<string, string>) {
  return {
    read: vi.fn((ref: string) => {
      if (ref in responses) {
        return Promise.resolve(responses[ref]);
      }
      return Promise.reject(new Error(`Not found: ${ref}`));
    }),
  };
}

describe("resolveSecrets", () => {
  it("resolves op:// references", async () => {
    const client = createOpClient({
      "op://vault/item/field": "secret-value",
    });

    const config = { apiKey: "op://vault/item/field" };
    const resolved = await resolveSecrets(config, client);

    expect(resolved).toEqual({ apiKey: "secret-value" });
    expect(client.read).toHaveBeenCalledWith("op://vault/item/field");
  });

  it("leaves non-op:// values unchanged", async () => {
    const client = createOpClient({});
    const config = {
      host: "https://example.com",
      port: 3000,
      enabled: true,
    };

    const resolved = await resolveSecrets(config, client);
    expect(resolved).toEqual({
      host: "https://example.com",
      port: 3000,
      enabled: true,
    });
    expect(client.read).not.toHaveBeenCalled();
  });

  it("graceful fallback when op CLI not available", async () => {
    const client = createOpClient({});
    const config = { apiKey: "op://vault/item/field" };

    const resolved = await resolveSecrets(config, client, { graceful: true });
    expect(resolved).toEqual({ apiKey: "op://vault/item/field" });
  });

  it("throws by default when resolution fails", async () => {
    const client = createOpClient({});
    const config = { apiKey: "op://vault/item/field" };

    await expect(resolveSecrets(config, client)).rejects.toThrow(
      "Failed to resolve secret: op://vault/item/field",
    );
  });

  it("resolves nested op:// references in deep objects", async () => {
    const client = createOpClient({
      "op://vault/db-pass/field": "db-secret",
      "op://vault/api-key/field": "api-secret",
    });

    const config = {
      database: {
        host: "localhost",
        password: "op://vault/db-pass/field",
      },
      services: [{ name: "auth", token: "op://vault/api-key/field" }],
    };

    const resolved = await resolveSecrets(config, client);
    expect(resolved).toEqual({
      database: {
        host: "localhost",
        password: "db-secret",
      },
      services: [{ name: "auth", token: "api-secret" }],
    });
  });

  it("handles null and undefined values", async () => {
    const client = createOpClient({});
    const config = { a: null, b: undefined };

    const resolved = await resolveSecrets(config, client);
    expect(resolved).toEqual({ a: null, b: undefined });
  });

  it("handles empty objects and arrays", async () => {
    const client = createOpClient({});
    const config = { items: [], nested: {} };

    const resolved = await resolveSecrets(config, client);
    expect(resolved).toEqual({ items: [], nested: {} });
  });
});
