import type { TurnRecord } from "../loop/turn.js";
import type { Agent } from "./agent.js";

/**
 * The eval harness (spec §7.3). A scenario is a prompt + the agent that runs it +
 * assertions over the resulting `TurnRecord`. Because the agent is driven by a
 * deterministic (scripted) adapter, scenarios are reproducible and double as
 * regression fixtures — this is the home of the headline hallucination test.
 */
export interface Assertion {
  description: string;
  check: (rec: TurnRecord) => boolean;
}

export interface Scenario {
  name: string;
  prompt: string;
  agent: () => Promise<Agent>;
  assertions: Assertion[];
}

export interface ScenarioResult {
  name: string;
  passed: boolean;
  failures: string[];
  record: TurnRecord;
}

export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const agent = await scenario.agent();
  const record = await agent.ask(scenario.prompt);
  const failures = scenario.assertions.filter((a) => !a.check(record)).map((a) => a.description);
  return { name: scenario.name, passed: failures.length === 0, failures, record };
}

// --- Assertion builders ----------------------------------------------------

export const calledToolSuccessfully = (tool: string): Assertion => ({
  description: `called ${tool} successfully`,
  check: (r) => r.toolCalls.some((t) => t.result.ok && t.call.tool === tool),
});

export const noToolCalled = (): Assertion => ({
  description: "no tool was called",
  check: (r) => r.toolCalls.length === 0,
});

export const wasAccepted = (): Assertion => ({
  description: "a final answer was accepted",
  check: (r) => r.accepted,
});

export const issuedCorrection = (): Assertion => ({
  description: "at least one correction was issued (grounding enforced)",
  check: (r) => r.corrections.length > 0,
});

export const finalContains = (text: string): Assertion => ({
  description: `final answer contains "${text}"`,
  check: (r) => (r.final ?? "").includes(text),
});

/** The claim-citation numeric check: the accepted final states the tool's number. */
export const finalMatchesToolNumber = (tool: string): Assertion => ({
  description: `final's number equals the ${tool} result`,
  check: (r) => {
    const call = r.toolCalls.find((t) => t.result.ok && t.call.tool === tool);
    if (!call) {
      return false;
    }
    const free = (call.result.data as { freeBytes?: number }).freeBytes;
    return free !== undefined && (r.final ?? "").includes(String(free));
  },
});
