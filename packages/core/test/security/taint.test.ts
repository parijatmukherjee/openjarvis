import { describe, it, expect } from "vitest";
import { provenance, requiresApproval } from "../../src/security/taint.js";

describe("provenance (The Gate)", () => {
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
