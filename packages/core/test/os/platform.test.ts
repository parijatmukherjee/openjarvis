import { describe, it, expect } from "vitest";
import { detectPlatform, freeDiskBytes, configDir, dataDir } from "../../src/os/platform.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("detectPlatform", () => {
  it("maps the current process.platform to a known os", () => {
    const p = detectPlatform();
    expect(["windows", "macos", "linux"]).toContain(p.os);
    expect(p.shell).toBeTruthy();
  });

  it("maps win32/darwin/linux deterministically when passed explicitly", () => {
    expect(detectPlatform("win32").os).toBe("windows");
    expect(detectPlatform("win32").shell).toBe("powershell");
    expect(detectPlatform("darwin").os).toBe("macos");
    expect(detectPlatform("linux").os).toBe("linux");
    expect(detectPlatform("linux").shell).toBe("bash");
  });
});

describe("freeDiskBytes", () => {
  it("returns a positive integer number of bytes for the temp dir", async () => {
    const bytes = await freeDiskBytes(tmpdir());
    expect(Number.isInteger(bytes)).toBe(true);
    expect(bytes).toBeGreaterThan(0);
  });
});

describe("configDir/dataDir", () => {
  const env = { HOME: "/home/x", APPDATA: "C:\\Users\\x\\AppData\\Roaming" };

  it("configDir uses APPDATA on windows", () => {
    expect(configDir("windows", env)).toBe(join(env.APPDATA, "openjarvis"));
  });
  it("configDir uses Application Support on macos", () => {
    expect(configDir("macos", env)).toBe(
      join(env.HOME, "Library", "Application Support", "openjarvis"),
    );
  });
  it("configDir uses .config on linux", () => {
    expect(configDir("linux", env)).toBe(join(env.HOME, ".config", "openjarvis"));
  });
  it("dataDir uses LOCALAPPDATA fallback on windows", () => {
    expect(dataDir("windows", env)).toBe(join(env.HOME, "AppData", "Local", "openjarvis"));
  });
  it("dataDir uses .local/share on linux", () => {
    expect(dataDir("linux", env)).toBe(join(env.HOME, ".local", "share", "openjarvis"));
  });
});
