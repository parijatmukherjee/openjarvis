import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { configDir, dataDir } from "../../src/os/platform.js";

describe("home resolution fallbacks", () => {
  it("falls back to USERPROFILE when HOME is unset", () => {
    expect(configDir("linux", { USERPROFILE: "/u" })).toBe(join("/u", ".config", "openhawkins"));
    expect(dataDir("linux", { USERPROFILE: "/u" })).toBe(
      join("/u", ".local", "share", "openhawkins"),
    );
  });

  it("falls back to an empty base when neither HOME nor USERPROFILE is set", () => {
    expect(configDir("linux", {})).toBe(join(".config", "openhawkins"));
    expect(dataDir("linux", {})).toBe(join(".local", "share", "openhawkins"));
  });
});
