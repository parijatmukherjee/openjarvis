import { describe, it, expect } from "vitest";
import { InMemoryVault } from "../../src/security/vault.js";

describe("Vault-wired adapter config", () => {
  it("prefers Vault over env for adapter keys", async () => {
    const vault = new InMemoryVault();
    await vault.set("openai-key", "vault-key-123");

    // Simulate what buildAdapter does: Vault first, then env.
    const getKey = async () => {
      const v = await vault.get("openai-key");
      if (v !== null) return v;
      return process.env.OPENJARVIS_OPENAI_KEY;
    };

    expect(await getKey()).toBe("vault-key-123");
  });

  it("falls back to env when Vault has no entry", async () => {
    const vault = new InMemoryVault();
    const original = process.env.OPENJARVIS_OPENAI_KEY;
    process.env.OPENJARVIS_OPENAI_KEY = "env-key-456";

    const getKey = async () => {
      const v = await vault.get("openai-key");
      if (v !== null) return v;
      return process.env.OPENJARVIS_OPENAI_KEY;
    };

    try {
      expect(await getKey()).toBe("env-key-456");
    } finally {
      if (original !== undefined) {
        process.env.OPENJARVIS_OPENAI_KEY = original;
      } else {
        delete process.env.OPENJARVIS_OPENAI_KEY;
      }
    }
  });
});
