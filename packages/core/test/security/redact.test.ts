import { describe, it, expect } from "vitest";
import { redact, REDACTED } from "../../src/security/redact.js";

describe("redact", () => {
  it("redacts values of secret-named fields, recursively", () => {
    const out = redact({
      model: "llama3.1",
      apiKey: "sk-cloud-xyz",
      nested: { password: "hunter2", keep: "ok" },
    });
    expect(out).toEqual({
      model: "llama3.1",
      apiKey: REDACTED,
      nested: { password: REDACTED, keep: "ok" },
    });
  });

  it("redacts secret-shaped values even under an innocent key name", () => {
    expect(redact({ note: "use Bearer sk-abcdefgh12345 to auth" })).toEqual({
      note: `use ${REDACTED} to auth`,
    });
  });

  it("does not mutate the input", () => {
    const input = { apiKey: "sk-keepme-original" };
    redact(input);
    expect(input.apiKey).toBe("sk-keepme-original");
  });

  it("passes through non-secret primitives untouched", () => {
    expect(redact({ count: 3, ok: true, name: "disk_free" })).toEqual({
      count: 3,
      ok: true,
      name: "disk_free",
    });
  });
});
