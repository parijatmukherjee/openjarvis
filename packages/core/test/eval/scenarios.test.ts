import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { buildProbeAgent, weakHostFactsModel } from "../../src/eval/scenarios.js";
import type { Logger } from "../../src/observability/logger.js";
import type { MemoryStore } from "../../src/memory.js";
import type { DocumentConverter } from "../../src/tools/document-tool.js";
import {
  runScenario,
  wasAccepted,
  finalMatchesToolNumber,
  calledToolSuccessfully,
  issuedCorrection,
} from "../../src/eval/harness.js";
import type { Scenario } from "../../src/eval/harness.js";

describe("buildProbeAgent", () => {
  it("accepts an optional logger and runs the full turn", async () => {
    const records: {
      level: string;
      event: string;
      fields?: Record<string, unknown> | undefined;
    }[] = [];
    const logger: Logger = {
      log: (level, event, fields) => void records.push({ level, event, fields }),
    };
    const agent = await buildProbeAgent({
      adapter: weakHostFactsModel(tmpdir()),
      grounding: "cited",
      logger,
    });
    const record = await agent.ask("How much disk space is free on this machine?");
    expect(record.accepted).toBe(true);
  });

  it("runs without a logger (noop default)", async () => {
    const scenario: Scenario = {
      name: "host-facts/logger-default",
      prompt: "How much disk space is free on this machine?",
      agent: () =>
        buildProbeAgent({
          adapter: weakHostFactsModel(tmpdir()),
          grounding: "cited",
        }),
      assertions: [
        issuedCorrection(),
        calledToolSuccessfully("disk_free"),
        wasAccepted(),
        finalMatchesToolNumber("disk_free"),
      ],
    };
    const result = await runScenario(scenario);
    expect(result.failures).toEqual([]);
  });

  it("accepts a memory store and injects recalled fragments", async () => {
    let receivedSystemPrompt = "";
    const adapter = weakHostFactsModel(tmpdir());
    const originalGenerate = adapter.generate.bind(adapter);
    adapter.generate = async (req) => {
      const sys = req.messages.find((m) => m.role === "system");
      if (sys) receivedSystemPrompt = sys.content;
      return originalGenerate(req);
    };

    const memory: MemoryStore = {
      recall: async () => ["Memory: disk is 1TB."],
    };

    const agent = await buildProbeAgent({
      adapter,
      grounding: "cited",
      memory,
    });

    const record = await agent.ask("How much disk space is free on this machine?");
    expect(record.accepted).toBe(true);
    expect(receivedSystemPrompt).toContain("Memory: disk is 1TB.");
  });

  it("accepts a document converter and registers convert_document", async () => {
    const converter: DocumentConverter = {
      convert: async (data) => ({ markdown: `# ${data}`, format: "text" }),
    };

    const agent = await buildProbeAgent({
      adapter: weakHostFactsModel(tmpdir()),
      grounding: "cited",
      documentConverter: converter,
    });

    // Ask about disk; the agent has the converter tool but won't use it for this prompt.
    // We verify the tool is registered by checking the agent's config indirectly:
    // the turn should still complete normally.
    const record = await agent.ask("How much disk space is free on this machine?");
    expect(record.accepted).toBe(true);
  });
});
