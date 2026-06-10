import { describe, it, expect } from "vitest";
import { getAppVersion } from "../src/main.js";

describe("desktop smoke", () => {
  it("exports getAppVersion", () => {
    expect(typeof getAppVersion).toBe("function");
    expect(getAppVersion()).toBe("0.0.0");
  });
});
