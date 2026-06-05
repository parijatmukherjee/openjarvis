import { detectPlatform, freeDiskBytes, configDir } from "../os/platform.js";
import { tmpdir } from "node:os";

async function main(): Promise<void> {
  const p = detectPlatform();
  const free = await freeDiskBytes(tmpdir());
  console.log(
    JSON.stringify({ os: p.os, shell: p.shell, configDir: configDir(), freeDiskBytes: free }),
  );
}

await main();
