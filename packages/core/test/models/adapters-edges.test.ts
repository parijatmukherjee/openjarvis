import { describe, it, expect } from "vitest";
import { OllamaAdapter } from "../../src/models/ollama.js";
import { OpenAiCompatAdapter } from "../../src/models/openai-compat.js";
import type { HttpFetch } from "../../src/models/http.js";

function stub(responseBody: unknown): { http: HttpFetch; body: () => Record<string, unknown> } {
  let captured: Record<string, unknown> = {};
  const http: HttpFetch = async (_url, init) => {
    captured = JSON.parse(init.body) as Record<string, unknown>;
    return { ok: true, status: 200, text: async () => JSON.stringify(responseBody) };
  };
  return { http, body: () => captured };
}

describe("OllamaAdapter defaults & defensive parsing", () => {
  it("defaults to the real transport when no http is injected", () => {
    const adapter = new OllamaAdapter({ model: "m" });
    expect(adapter.name).toBe("ollama");
  });

  it("tolerates a tool_call missing its function name/arguments", async () => {
    const { http } = stub({ message: { content: "", tool_calls: [{}] } });
    const adapter = new OllamaAdapter({ model: "m", http });
    const res = await adapter.generate({ messages: [] });
    expect(res.toolCalls[0]).toEqual({ id: "oc-1", tool: "", args: {} });
  });
});

describe("OpenAiCompatAdapter request building", () => {
  it("includes tools + tool_choice and response_format when requested", async () => {
    const { http, body } = stub({ choices: [{ message: { content: "ok" } }] });
    const adapter = new OpenAiCompatAdapter({
      model: "m",
      baseUrl: "https://api.example/v1",
      http,
    });

    await adapter.generate({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "disk_free", description: "d", parameters: { type: "object" } }],
      responseSchema: { type: "object" },
    });

    const b = body();
    expect((b.tools as unknown[]).length).toBe(1);
    expect(b.tool_choice).toBe("auto");
    expect((b.response_format as { type: string }).type).toBe("json_schema");
  });
});
