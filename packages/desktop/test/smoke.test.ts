import { describe, it, expect } from "vitest";
import { getAppVersion } from "../src/main.js";

describe("desktop smoke", () => {
  it("exports getAppVersion", () => {
    expect(typeof getAppVersion).toBe("function");
    const v = getAppVersion();
    // Should return a valid semver-like string (e.g. "1.0.0" or "0.0.0")
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
