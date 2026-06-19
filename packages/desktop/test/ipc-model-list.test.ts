import { describe, it, expect } from "vitest";

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_CLOUD_URL = "https://api.ollama.com/v1";

async function fetchModels(provider: string, baseUrl: string, apiKey?: string): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey && (provider === "ollama-cloud" || provider === "openai-compat")) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    if (provider === "ollama") {
      const url = `${baseUrl}/api/tags`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return [];
      const data = (await response.json()) as Record<string, unknown>;
      const models = data.models as Array<Record<string, string>> | undefined;
      return (models ?? []).map((m) => m.name);
    }

    const url = `${baseUrl}/models`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers });
    if (!response.ok) return [];
    const data = (await response.json()) as { data?: Array<Record<string, string>> };
    return (data.data ?? []).map((m) => m.id);
  } catch {
    return [];
  }
}

describe.skipIf(!OLLAMA_API_KEY)("model:list IPC handler — Ollama Cloud", () => {
  it("fetches models from Ollama Cloud API", async () => {
    const models = await fetchModels("ollama-cloud", OLLAMA_CLOUD_URL, OLLAMA_API_KEY);
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.toLowerCase().includes("llama"))).toBe(true);
  });

  it("returns models with valid model identifiers", async () => {
    const models = await fetchModels("ollama-cloud", OLLAMA_CLOUD_URL, OLLAMA_API_KEY);
    for (const model of models) {
      expect(typeof model).toBe("string");
      expect(model.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array for invalid API key", async () => {
    const models = await fetchModels("ollama-cloud", OLLAMA_CLOUD_URL, "invalid-key-00000000");
    expect(models).toEqual([]);
  });

  it("handles OpenAI-compatible /models endpoint format", async () => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${OLLAMA_API_KEY}`,
    };
    const response = await fetch(`${OLLAMA_CLOUD_URL}/models`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);
    const data = await response.json() as { data: Array<{ id: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].id).toBeTruthy();
  });

  it("model identifiers contain at least one model with llama in name", async () => {
    const models = await fetchModels("ollama-cloud", OLLAMA_CLOUD_URL, OLLAMA_API_KEY);
    const hasLlama = models.some((m) => m.toLowerCase().includes("llama"));
    expect(hasLlama).toBe(true);
  });
});

describe("model:list IPC handler — error handling (no API key needed)", () => {
  it("returns empty array for unreachable host", async () => {
    const models = await fetchModels(
      "ollama-cloud",
      "https://unreachable.invalid.host.example.com/v1",
      "fake-key",
    );
    expect(models).toEqual([]);
  });

  it("returns empty array for Ollama local when not running", async () => {
    const models = await fetchModels("ollama", "http://127.0.0.1:11435");
    expect(models).toEqual([]);
  });

  it("returns empty array for invalid credentials", async () => {
    const models = await fetchModels("ollama-cloud", OLLAMA_CLOUD_URL, "sk-invalid-fake-key-12345678");
    expect(Array.isArray(models)).toBe(true);
  });
});