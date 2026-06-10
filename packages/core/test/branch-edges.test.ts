import { describe, it, expect } from "vitest";
import { OllamaAdapter } from "../src/models/ollama.js";
import { OpenAiCompatAdapter } from "../src/models/openai-compat.js";
import { GroundingEngine } from "../src/grounding/grounding-engine.js";
import type { HttpFetch } from "../src/models/http.js";

const stub =
  (body: unknown): HttpFetch =>
  async () => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

describe("remaining defensive branches", () => {
  it("OpenAiCompatAdapter defaults its transport and tolerates an empty choices array", async () => {
    expect(new OpenAiCompatAdapter({ model: "m", baseUrl: "https://x/v1" }).name).toBe(
      "openai-compat",
    );
    const adapter = new OpenAiCompatAdapter({
      model: "m",
      baseUrl: "https://x/v1",
      http: stub({ choices: [] }),
    });
    expect(await adapter.generate({ messages: [] })).toEqual({ content: "", toolCalls: [] });
  });

  it("OllamaAdapter tolerates a response message with no content field", async () => {
    const adapter = new OllamaAdapter({ model: "m", http: stub({ message: { tool_calls: [] } }) });
    expect((await adapter.generate({ messages: [] })).content).toBe("");
  });

  it("Eleven uses a generic tool name in its correction when none are configured", () => {
    const decision = new GroundingEngine({ mode: "required" }).evaluate({
      final: "a guess",
      toolResults: [],
    });
    expect(decision.accept).toBe(false);
    expect(decision.correction).toMatch(/the required tool/);
  });
});
