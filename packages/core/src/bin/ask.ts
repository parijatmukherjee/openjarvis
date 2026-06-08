import { tmpdir } from "node:os";
import type { ModelAdapter } from "../models/adapter.js";
import { OllamaAdapter } from "../models/ollama.js";
import { OpenAiCompatAdapter } from "../models/openai-compat.js";
import type { GroundingMode } from "../grounding/eleven.js";
import { buildProbeAgent, weakHostFactsModel } from "../eval/scenarios.js";

/**
 * `openhawkins ask` — the tiny CLI driver for the vertical slice (spec §2 non-goals:
 * "exercised via the eval harness + a tiny CLI driver"). This is the command a user
 * actually runs:
 *
 *   ask "How much disk space is free on this machine?"            # scripted demo
 *   ask "..." --model ollama                                      # real local model
 *   ask "..." --grounding off                                     # the negative control
 *   ask "..." --json                                              # machine-readable trace
 *
 * `--model scripted` (default) uses the deterministic weak-model stand-in so the
 * command always works offline and is reproducible; the REAL machine, REAL tool, and
 * REAL grounding still run — only the "model" is scripted.
 */

/** Flags that take a value (so the following token is consumed, not the prompt). */
const VALUE_FLAGS = ["--model", "--grounding", "--path"];

function flag(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

/** The first positional token (skipping flags and their values) is the prompt. */
function positionalPrompt(args: string[], fallback: string): string {
  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok.startsWith("--")) {
      if (VALUE_FLAGS.includes(tok)) {
        i++; // skip this flag's value
      }
      continue;
    }
    return tok;
  }
  return fallback;
}

function buildAdapter(kind: string, path: string): ModelAdapter {
  switch (kind) {
    case "scripted":
      return weakHostFactsModel(path);
    case "ollama":
      return new OllamaAdapter({
        model: process.env.OPENHAWKINS_OLLAMA_MODEL ?? "llama3.1",
        ...(process.env.OPENHAWKINS_OLLAMA_URL
          ? { baseUrl: process.env.OPENHAWKINS_OLLAMA_URL }
          : {}),
        ...(process.env.OPENHAWKINS_OLLAMA_KEY
          ? { apiKey: process.env.OPENHAWKINS_OLLAMA_KEY }
          : {}),
      });
    case "openai":
      return new OpenAiCompatAdapter({
        model: process.env.OPENHAWKINS_OPENAI_MODEL ?? "gpt-4o-mini",
        baseUrl: process.env.OPENHAWKINS_OPENAI_URL ?? "https://api.openai.com/v1",
        ...(process.env.OPENHAWKINS_OPENAI_KEY
          ? { apiKey: process.env.OPENHAWKINS_OPENAI_KEY }
          : {}),
      });
    default:
      throw new Error(`unknown --model "${kind}" (use scripted | ollama | openai)`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const prompt = positionalPrompt(args, "How much disk space is free on this machine?");
  const modelKind = flag(args, "--model", "scripted");
  const grounding = flag(args, "--grounding", "cited") as GroundingMode;
  const path = flag(args, "--path", tmpdir());
  const asJson = args.includes("--json");

  const adapter = buildAdapter(modelKind, path);
  const agent = await buildProbeAgent({ adapter, grounding });
  const record = await agent.ask(prompt);

  if (asJson) {
    const trace = {
      prompt,
      model: modelKind,
      grounding,
      accepted: record.accepted,
      corrections: record.corrections.length,
      modelCalls: record.modelCalls.length,
      toolCalls: record.toolCalls.map((t) => ({
        tool: t.call.tool,
        ok: t.result.ok,
        freeBytes: (t.result.data as { freeBytes?: number } | undefined)?.freeBytes,
      })),
      final: record.final ?? null,
    };
    console.log(JSON.stringify(trace));
  } else {
    console.log(record.final ?? "[no grounded answer]");
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
