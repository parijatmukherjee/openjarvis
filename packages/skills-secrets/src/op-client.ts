import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OpClientConfig {
  exec?: (
    file: string,
    args: readonly string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string }>;
}

export class OpClient {
  private readonly exec: (
    file: string,
    args: readonly string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string }>;

  constructor(config: OpClientConfig = {}) {
    this.exec =
      config.exec ??
      (execFileAsync as (
        file: string,
        args: readonly string[],
        options?: { timeout?: number },
      ) => Promise<{ stdout: string; stderr: string }>);
  }

  async read(reference: string): Promise<string> {
    if (!reference.startsWith("op://")) {
      throw new Error(`invalid reference: must start with "op://", got "${reference}"`);
    }
    try {
      const { stdout } = await this.exec("op", ["read", reference], { timeout: 10_000 });
      return stdout.replace(/\n$/, "");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("ENOENT") || err.message.includes("not found")) {
          throw new Error(
            "1Password CLI (op) not found. Install it from https://1password.com/downloads/",
          );
        }
        if (err.message.includes("authentication") || err.message.includes("not signed in")) {
          throw new Error(
            "1Password CLI not authenticated. Run `op account add` or `eval $(op signin)`.",
          );
        }
        if (err.message.includes("doesn't exist")) {
          throw new Error(`1Password item not found: ${reference}`);
        }
      }
      throw err;
    }
  }
}
