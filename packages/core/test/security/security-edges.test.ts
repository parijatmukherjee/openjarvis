import { describe, it, expect } from "vitest";
import { redact, REDACTED } from "../../src/security/redact.js";

describe("redact — arrays", () => {
  it("redacts secret-shaped values inside arrays", () => {
    expect(redact(["Bearer sk-abcdefgh12345", "plain"])).toEqual([REDACTED, "plain"]);
  });
});
