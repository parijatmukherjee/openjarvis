import { describe, it, expect } from "vitest";
import { runGate, CHECKERS, type CheckResult } from "../src/gate.js";

describe("Gate Checks", () => {
  it("passes when all checks succeed", async () => {
    const mockCheckers = {
      build: async () => true,
      lint: async () => true,
      format: async () => true,
      test: async () => true,
      coverage: async () => true,
    };
    const result: CheckResult = await runGate(["build", "lint"], mockCheckers);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when a check fails", async () => {
    const mockCheckers = {
      build: async () => false,
      lint: async () => true,
      format: async () => true,
      test: async () => true,
      coverage: async () => true,
    };
    const result: CheckResult = await runGate(["build", "lint"], mockCheckers);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("build failed");
  });

  it("returns passed=true for empty checks", async () => {
    const result: CheckResult = await runGate([], {});
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("exports CHECKERS map", () => {
    expect(Object.keys(CHECKERS)).toEqual([
      "build",
      "lint",
      "format",
      "test",
      "coverage",
    ]);
  });
});
