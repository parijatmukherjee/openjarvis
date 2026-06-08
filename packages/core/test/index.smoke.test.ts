import { describe, it, expect } from "vitest";
import * as oh from "../src/index.js";

// Importing the public barrel executes every module's top level and is what a
// consumer of @openhawkins/core actually does. It also keeps the barrel honest:
// if an export is renamed/removed, this fails.
describe("@openhawkins/core public surface", () => {
  it("re-exports the core runtime building blocks", () => {
    const expected = [
      "Session",
      "InMemoryEventStore",
      "ToolRegistry",
      "diskFreeTool",
      "Eleven",
      "Agent",
      "runAgentTurn",
      "ScriptedAdapter",
      "OllamaAdapter",
      "OpenAiCompatAdapter",
      "FileVault",
      "InMemoryVault",
      "InMemoryAuditLog",
      "runScenario",
      "buildProbeAgent",
    ] as const;
    for (const name of expected) {
      expect(oh, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});
