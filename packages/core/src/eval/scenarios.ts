import type { ModelAdapter } from "../models/adapter.js";
import { ScriptedAdapter } from "../models/scripted.js";
import { ToolRegistry } from "../tools/registry.js";
import { diskFreeTool } from "../tools/disk-free.js";
import type { ToolDefinition } from "../tools/tool.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;
import type { GroundingMode } from "../grounding/grounding-engine.js";
import { Agent } from "./agent.js";
import type { Logger } from "../observability/logger.js";
import type { MemoryStore } from "../memory.js";
import { createDocumentTool, type DocumentConverter } from "../tools/document-tool.js";

type DiskFreeTool = ToolDefinition<{ path: string }, { path: string; freeBytes: number }>;

/** A `disk_free` that reports a fixed number instead of reading the real filesystem —
 *  used by determinism tests so the whole pipeline is reproducible (the real disk's free
 *  bytes drift between calls). Same name/args/result/capabilities as the real tool. */
function fixedDiskFreeTool(freeBytes: number): DiskFreeTool {
  return { ...diskFreeTool, handler: async (args) => ({ path: args.path, freeBytes }) };
}

/**
 * The vertical slice's agent (spec §3): one agent (`probe-agent`), one tool
 * (`disk_free`), one skill (`host-facts`, grounding `cited`). The grounding mode is
 * a parameter so the SAME agent powers both the headline test (cited) and the
 * negative control (off) — proving the grounding engine is what makes the difference.
 *
 * `diskFree`, when set, swaps the real `disk_free` for one that reports that fixed
 * number — so a determinism test gets a fully reproducible run without a live disk read.
 */
export function buildProbeAgent(opts: {
  adapter: ModelAdapter;
  grounding: GroundingMode;
  diskFree?: number;
  logger?: Logger;
  /** Optional memory store for context injection (e.g. JarvisMemoryStore). */
  memory?: MemoryStore;
  /** Optional document converter for token reduction (e.g. `@openjarvis/markdownify`).
   *  When provided, a `convert_document` tool is registered. */
  documentConverter?: DocumentConverter;
}): Promise<Agent> {
  const tool: DiskFreeTool =
    opts.diskFree === undefined ? diskFreeTool : fixedDiskFreeTool(opts.diskFree);
  const registry = new ToolRegistry(opts.logger);
  registry.register(tool);
  const tools: AnyToolDefinition[] = [tool];
  if (opts.documentConverter) {
    const docTool = createDocumentTool(opts.documentConverter);
    registry.register(docTool);
    tools.push(docTool);
  }
  return Agent.start({
    agentId: "probe-agent",
    adapter: opts.adapter,
    registry,
    grant: { agentId: "probe-agent", capabilities: [{ name: "host:info" }] },
    tools,
    grounding: { mode: opts.grounding, qualifyingTools: ["disk_free"] },
    systemPrompt: "You are probe-agent. Answer questions about this host accurately.",
    ...(opts.memory ? { memory: opts.memory } : {}),
  });
}

/**
 * A deterministic stand-in for a **weak model** — the kind that hallucinates. It
 * faithfully reproduces the failure-then-recovery a real weak model exhibits:
 *
 *   1. fabricate a plausible number WITHOUT calling the tool;
 *   2. (after the engine's correction) call `disk_free`;
 *   3. answer as a cited JSON object using the REAL number the tool returned.
 *
 * Under `off` grounding the loop accepts step 1 (the fabrication) and never advances
 * — which is exactly the negative control. Under `cited` grounding the engine rejects
 * step 1, forcing 2 and 3. Same model, opposite outcomes.
 */
export function weakHostFactsModel(path: string): ScriptedAdapter {
  return new ScriptedAdapter(
    [
      // 1. The hallucination: a confident, specific, WRONG answer with no tool call.
      { content: "Your machine has about 250 GB of free disk space.", toolCalls: [] },
      // 2. Forced to ground: call the real tool.
      { content: "", toolCalls: [{ id: "oc-1", tool: "disk_free", args: { path } }] },
      // 3. Answer citing the actual tool result.
      (req) => {
        const toolMsg = req.messages.findLast((m) => m.role === "tool");
        const free = (JSON.parse(toolMsg?.content ?? "{}") as { data?: { freeBytes?: number } })
          .data?.freeBytes;
        return {
          content: JSON.stringify({
            text: `${free} bytes are free on this machine.`,
            claims: [
              {
                statement: `${free} bytes are free`,
                citesToolResultId: "oc-1",
                value: free,
                field: "freeBytes",
              },
            ],
          }),
          toolCalls: [],
        };
      },
    ],
    "weak-host-facts",
  );
}
