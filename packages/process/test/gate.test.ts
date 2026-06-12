import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gate from "../src/gate.js";
import { execSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("Gate Checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports CHECKERS map", () => {
    expect(Object.keys(gate.CHECKERS)).toEqual(["build", "lint", "format", "test", "coverage"]);
  });

  it("passes when all checks succeed", async () => {
    const result = await gate.runGate(["build", "lint"], {
      build: async () => true,
      lint: async () => true,
      format: async () => true,
      test: async () => true,
      coverage: async () => true,
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when a check fails", async () => {
    const result = await gate.runGate(["build", "lint"], {
      build: async () => false,
      lint: async () => true,
      format: async () => true,
      test: async () => true,
      coverage: async () => true,
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("build failed");
  });

  it("returns passed=true for empty checks", async () => {
    const result = await gate.runGate([], {});
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("runs gate with default CHECKERS when no custom checkers provided", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => "");
    const result = await gate.runGate(["build"]);
    expect(result.passed).toBe(true);
  });

  it("ignores unknown checks silently", async () => {
    const result = await gate.runGate(["unknown-check"], {});
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("checkBuild returns true on success", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => "");
    expect(await gate.checkBuild()).toBe(true);
  });

  it("checkBuild returns false on failure", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fail");
    });
    expect(await gate.checkBuild()).toBe(false);
  });

  it("checkLint returns true on success", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => "");
    expect(await gate.checkLint()).toBe(true);
  });

  it("checkFormat returns true on success", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => "");
    expect(await gate.checkFormat()).toBe(true);
  });

  it("checkTests returns true on success", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => "");
    expect(await gate.checkTests()).toBe(true);
  });

  it("checkLint returns false on failure", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fail");
    });
    expect(await gate.checkLint()).toBe(false);
  });

  it("checkFormat returns false on failure", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fail");
    });
    expect(await gate.checkFormat()).toBe(false);
  });

  it("checkTests returns false on failure", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fail");
    });
    expect(await gate.checkTests()).toBe(false);
  });

  it("checkCoverage returns false on failure", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fail");
    });
    expect(await gate.checkCoverage()).toBe(false);
  });

  it("validatePhase throws when gate fails", async () => {
    await expect(
      gate.validatePhase(
        { currentPhase: "", completedPhases: [], phaseResults: {}, startTime: 0, metadata: {} },
        {
          build: async () => false,
          lint: async () => true,
          format: async () => true,
          test: async () => true,
          coverage: async () => true,
        },
      ),
    ).rejects.toThrow("Gate failed");
  });

  it("validatePhase returns logs when gate passes", async () => {
    const result = await gate.validatePhase(
      { currentPhase: "", completedPhases: [], phaseResults: {}, startTime: 0, metadata: {} },
      {
        build: async () => true,
        lint: async () => true,
        format: async () => true,
        test: async () => true,
        coverage: async () => true,
      },
    );
    expect(result.logs).toContain("all gates passed");
  });
});
