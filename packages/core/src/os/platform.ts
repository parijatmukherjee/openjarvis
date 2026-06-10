import { statfs } from "node:fs/promises";
import { join } from "node:path";

export type OsName = "windows" | "macos" | "linux";
export type ShellName = "powershell" | "bash";

export interface PlatformInfo {
  os: OsName;
  shell: ShellName;
}

export function detectPlatform(platform: NodeJS.Platform = process.platform): PlatformInfo {
  switch (platform) {
    case "win32":
      return { os: "windows", shell: "powershell" };
    case "darwin":
      return { os: "macos", shell: "bash" };
    default:
      return { os: "linux", shell: "bash" };
  }
}

// statfs is cross-platform on Node >= 19 (incl. Windows). bavail = blocks
// available to an unprivileged user; bsize = fundamental block size.
export async function freeDiskBytes(path: string): Promise<number> {
  const s = await statfs(path);
  return Math.floor(Number(s.bavail) * Number(s.bsize));
}

type Env = Record<string, string | undefined>;
const APP = "openjarvis";

export function configDir(os: OsName = detectPlatform().os, env: Env = process.env): string {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  switch (os) {
    case "windows":
      return join(env.APPDATA ?? join(home, "AppData", "Roaming"), APP);
    case "macos":
      return join(home, "Library", "Application Support", APP);
    default:
      return join(env.XDG_CONFIG_HOME ?? join(home, ".config"), APP);
  }
}

export function dataDir(os: OsName = detectPlatform().os, env: Env = process.env): string {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  switch (os) {
    case "windows":
      return join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), APP);
    case "macos":
      return join(home, "Library", "Application Support", APP);
    default:
      return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), APP);
  }
}
