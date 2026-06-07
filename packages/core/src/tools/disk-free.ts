import { z } from "zod";
import type { ToolDefinition } from "./tool.js";
import { freeDiskBytes } from "../os/platform.js";

/**
 * Report free disk space (bytes) on the filesystem containing `path`. This is the
 * grounding-required tool the S1.7 hallucination test exercises: the agent must
 * call this rather than guess. Needs the read-only `host:info` capability.
 */
export const diskFreeTool: ToolDefinition<{ path: string }, { path: string; freeBytes: number }> = {
  name: "disk_free",
  description: "Report the number of bytes free on the filesystem containing the given path.",
  args: z.object({ path: z.string().min(1) }),
  result: z.object({ path: z.string(), freeBytes: z.number().int().nonnegative() }),
  capabilities: [{ name: "host:info" }],
  handler: async (args) => {
    const freeBytes = await freeDiskBytes(args.path);
    return { path: args.path, freeBytes };
  },
};
