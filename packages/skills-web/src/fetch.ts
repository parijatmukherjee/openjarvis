import { z } from "zod";
import { markdownify } from "@openjarvis/markdownify";
import type { ToolDefinition, ToolContext } from "@openjarvis/core";
import type { ToolRegistry } from "@openjarvis/core";

export interface WebFetchConfig {
  fetch?: typeof globalThis.fetch;
  maxBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

const WebFetchArgs = z.object({
  url: z.string().url(),
  format: z.enum(["markdown", "text"]),
});

const WebFetchResult = z.object({
  markdown: z.string(),
  title: z.string().optional(),
  url: z.string(),
  format: z.string(),
});

export type WebFetchArgs = z.infer<typeof WebFetchArgs>;
export type WebFetchResult = z.infer<typeof WebFetchResult>;

export function createWebFetchTool(config: WebFetchConfig = {}): ToolDefinition<WebFetchArgs, WebFetchResult> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "web_fetch",
    description: "Fetch a URL and convert the response to clean Markdown text",
    args: WebFetchArgs,
    result: WebFetchResult,
    capabilities: [
      { name: "web:fetch" as const },
      { name: "document:convert" as const },
    ],
    handler: async (args: WebFetchArgs, _ctx: ToolContext): Promise<WebFetchResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(args.url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        const buf = await response.arrayBuffer();
        if (buf.byteLength > maxBytes) {
          throw new Error(`response exceeds max size (${buf.byteLength} > ${maxBytes})`);
        }
        const data = new Uint8Array(buf);
        const mime = contentType?.split(";")[0]?.trim();
        const input: { data: Uint8Array; filename: string; mime?: string } = {
          data,
          filename: args.url,
        };
        if (mime) input.mime = mime;
        try {
          const result = await markdownify(input);
          return { markdown: result.markdown, title: result.title, url: args.url, format: result.format };
        } catch {
          const text = typeof data === "object"
            ? new TextDecoder().decode(data)
            : String(data);
          return { markdown: text, title: undefined, url: args.url, format: "text" };
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function registerWebFetchTools(registry: ToolRegistry, config: WebFetchConfig = {}): void {
  registry.register(createWebFetchTool(config));
}