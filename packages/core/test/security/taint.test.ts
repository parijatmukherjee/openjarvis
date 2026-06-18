import { describe, it, expect } from "vitest";
import { provenance, requiresApproval, TaintError } from "../../src/security/taint.js";

describe("provenance (the Gate)", () => {
  it("marks external content as tainted and trusted sources as clean", () => {
    expect(provenance("external", "telegram-msg").taint).toBe(true);
    expect(provenance("operator", "cli").taint).toBe(false);
    expect(provenance("tool", "disk_free").taint).toBe(false);
  });
});

describe("requiresApproval (taint -> approval rule)", () => {
  it("requires approval for a side-effecting action influenced by tainted content", () => {
    expect(
      requiresApproval({
        sideEffecting: true,
        influencedBy: [provenance("operator", "cli"), provenance("external", "web")],
      }),
    ).toBe(true);
  });

  it("does not require approval for a read-only action, even with tainted inputs", () => {
    expect(
      requiresApproval({ sideEffecting: false, influencedBy: [provenance("external", "web")] }),
    ).toBe(false);
  });

  it("does not require approval when no input is tainted", () => {
    expect(
      requiresApproval({ sideEffecting: true, influencedBy: [provenance("tool", "disk_free")] }),
    ).toBe(false);
  });
});

describe("TaintError", () => {
  it("is throwable with correct name and message", () => {
    const error = new TaintError("tainted input blocked");
    expect(error.name).toBe("TaintError");
    expect(error.message).toBe("tainted input blocked");
    expect(error).toBeInstanceOf(Error);
  });

  it("can be caught in a try/catch", () => {
    try {
      throw new TaintError("side-effect gated");
    } catch (err) {
      expect(err).toBeInstanceOf(TaintError);
      expect((err as TaintError).name).toBe("TaintError");
      expect((err as TaintError).message).toBe("side-effect gated");
      return;
    }
    expect.unreachable("should have thrown");
  });
});
