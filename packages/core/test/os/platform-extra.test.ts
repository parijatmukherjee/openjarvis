import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { configDir, dataDir } from "../../src/os/platform.js";

describe("dataDir resolves per OS", () => {
  const env = {
    HOME: "/home/x",
    LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local",
    XDG_DATA_HOME: "/home/x/.local/share",
  };

  it("uses LOCALAPPDATA on windows", () => {
    expect(dataDir("windows", env)).toBe(join(env.LOCALAPPDATA, "openhawkins"));
  });

  it("uses Application Support on macos", () => {
    expect(dataDir("macos", env)).toBe(
      join("/home/x", "Library", "Application Support", "openhawkins"),
    );
  });

  it("uses the XDG data dir on linux", () => {
    expect(dataDir("linux", env)).toBe(join("/home/x", ".local", "share", "openhawkins"));
  });
});

describe("dir resolution falls back when env vars are absent", () => {
  it("derives windows paths from HOME when APPDATA/LOCALAPPDATA are unset", () => {
    const env = { HOME: "/h" };
    expect(configDir("windows", env)).toBe(join("/h", "AppData", "Roaming", "openhawkins"));
    expect(dataDir("windows", env)).toBe(join("/h", "AppData", "Local", "openhawkins"));
  });

  it("derives linux paths from HOME when XDG vars are unset", () => {
    const env = { HOME: "/h" };
    expect(configDir("linux", env)).toBe(join("/h", ".config", "openhawkins"));
    expect(dataDir("linux", env)).toBe(join("/h", ".local", "share", "openhawkins"));
  });
});
