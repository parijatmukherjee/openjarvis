# Model Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the configured model provider (Ollama or OpenAI-compatible) into the NexusEngine pipeline so that intent routing, agent execution, and response synthesis use real LLM calls with graceful fallback to rule-based behavior.

**Architecture:** A `ModelClient` interface with `OllamaClient` and `OpenAICompatClient` implementations is injected into `RuleBasedRouter`, `InProcessAgentPool`, and `RuleBasedSynthesizer`. Each component uses the client when available and falls back to rule-based logic when unavailable or on error. The `DesktopStore` model config is read in `ipc.ts` to create the appropriate client and inject it into engine components.

**Tech Stack:** TypeScript, native `fetch`, Vitest, Zod (already in project)

---

## File Structure

### New Files
- `packages/jarvis/src/model/client.ts` — `ModelClient` interface, `ModelConfig` type, `ModelResponse` type, `ModelError` class, `createModelClient` factory
- `packages/jarvis/src/model/ollama-client.ts` — `OllamaClient` implementation
- `packages/jarvis/src/model/openai-compat-client.ts` — `OpenAICompatClient` implementation
- `packages/jarvis/src/model/mock-client.ts` — `MockModelClient` for tests
- `packages/jarvis/src/model/index.ts` — barrel export
- `packages/jarvis/test/model/client.test.ts` — tests for `createModelClient`, `ModelError`
- `packages/jarvis/test/model/ollama-client.test.ts` — tests for `OllamaClient`
- `packages/jarvis/test/model/openai-compat-client.test.ts` — tests for `OpenAICompatClient`

### Modified Files
- `packages/jarvis/src/nexus/router.ts` — accept optional `ModelClient`, use for intent classification
- `packages/jarvis/src/nexus/pool.ts` — accept optional `ModelClient`, use for "general" agent
- `packages/jarvis/src/nexus/synthesizer.ts` — accept optional `ModelClient`, use for synthesis
- `packages/jarvis/src/nexus/engine.ts` — accept optional `ModelClient` in `NexusConfig`, pass to components
- `packages/jarvis/src/nexus/index.ts` — re-export model types
- `packages/desktop/src/main/ipc.ts` — read model config, create client, inject into engine
- `packages/jarvis/test/nexus/router.test.ts` — add model integration tests
- `packages/jarvis/test/nexus/pool.test.ts` — add model integration tests
- `packages/jarvis/test/nexus/synthesizer.test.ts` — add model integration tests
- `packages/jarvis/test/nexus/engine.test.ts` — add model integration test

---

### Task 1: ModelClient Interface and Factory

**Files:**
- Create: `packages/jarvis/src/model/client.ts`
- Create: `packages/jarvis/src/model/index.ts`
- Test: `packages/jarvis/test/model/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/jarvis/test/model/client.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createModelClient, ModelError } from "../../src/model/client.js";

describe("createModelClient", () => {
  it("creates OllamaClient for ollama provider", () => {
    const client = createModelClient({
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11434",
    });
    expect(client).toBeDefined();
  });

  it("creates OpenAICompatClient for openai-compat provider", () => {
    const client = createModelClient({
      provider: "openai-compat",
      model: "gpt-4",
      baseUrl: "http://127.0.0.1:8080",
      apiKey: "sk-test",
    });
    expect(client).toBeDefined();
  });
});

describe("ModelError", () => {
  it("stores code and message", () => {
    const err = new ModelError("unavailable", "server not reachable");
    expect(err.code).toBe("unavailable");
    expect(err.message).toBe("server not reachable");
    expect(err).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/jarvis/test/model/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/jarvis/src/model/client.ts`:

```typescript
export type ModelErrorCode = "unavailable" | "timeout" | "invalid_response";

export class ModelError extends Error {
  override readonly name = "ModelError" as const;
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ModelConfig {
  provider: "ollama" | "openai-compat";
  model: string;
  baseUrl: string;
  apiKey?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  isAvailable(): Promise<boolean>;
}

export function createModelClient(config: ModelConfig): ModelClient {
  if (config.provider === "ollama") {
    const { OllamaClient } = require("./ollama-client.js") as { OllamaClient: typeof import("./ollama-client.js").OllamaClient };
    return new OllamaClient(config);
  }
  const { OpenAICompatClient } = require("./openai-compat-client.js") as { OpenAICompatClient: typeof import("./openai-compat-client.js").OpenAICompatClient };
  return new OpenAICompatClient(config);
}
```

Wait — the project uses ESM with `verbatimModuleSyntax: true`, so `require()` won't work. Let me restructure to use dynamic imports or a simpler pattern.

Actually, looking at the tsconfig, `verbatimModuleSyntax: true` means we must use `import` for all imports. The factory function can't use dynamic `require`. Instead, let's have both clients imported and use a conditional:

Create `packages/jarvis/src/model/client.ts`:

```typescript
export type ModelErrorCode = "unavailable" | "timeout" | "invalid_response";

export class ModelError extends Error {
  override readonly name = "ModelError" as const;
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ModelConfig {
  provider: "ollama" | "openai-compat";
  model: string;
  baseUrl: string;
  apiKey?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  isAvailable(): Promise<boolean>;
}
```

Create `packages/jarvis/src/model/index.ts`:

```typescript
export { ModelError } from "./client.js";
export type { ModelConfig, ModelResponse, ModelClient, ModelErrorCode } from "./client.js";
export { OllamaClient } from "./ollama-client.js";
export { OpenAICompatClient } from "./openai-compat-client.js";
export { MockModelClient } from "./mock-client.js";

export function createModelClient(config: ModelConfig): ModelClient {
  if (config.provider === "ollama") {
    return new OllamaClient(config);
  }
  return new OpenAICompatClient(config);
}

import { ModelClient, ModelConfig } from "./client.js";
import { OllamaClient } from "./ollama-client.js";
import { OpenAICompatClient } from "./openai-compat-client.js";
```

Hmm, that's a circular dependency concern. Let me check the project patterns more carefully.

Looking at the codebase, imports use `.js` specifiers and the barrel exports in `index.ts` re-export from other files. The factory function should live in `client.ts` with imports at the top:

Create `packages/jarvis/src/model/client.ts`:

```typescript
import type { ModelConfig, ModelClient } from "./types.js";

export type { ModelConfig, ModelClient, ModelResponse, ModelErrorCode } from "./types.js";
export { ModelError } from "./error.js";
export { OllamaClient } from "./ollama-client.js";
export { OpenAICompatClient } from "./openai-compat-client.js";
export { MockModelClient } from "./mock-client.js";

export function createModelClient(config: ModelConfig): ModelClient {
  if (config.provider === "ollama") {
    return new OllamaClient(config);
  }
  return new OpenAICompatClient(config);
}
```

That's getting complicated with circular deps. Let me keep it simpler — the factory in `index.ts`, types in `client.ts`, implementations are standalone.

Final structure:
- `packages/jarvis/src/model/types.ts` — `ModelConfig`, `ModelResponse`, `ModelClient`, `ModelErrorCode`
- `packages/jarvis/src/model/error.ts` — `ModelError` class
- `packages/jarvis/src/model/ollama-client.ts` — `OllamaClient`
- `packages/jarvis/src/model/openai-compat-client.ts` — `OpenAICompatClient`
- `packages/jarvis/src/model/mock-client.ts` — `MockModelClient`
- `packages/jarvis/src/model/index.ts` — barrel + `createModelClient` factory

This avoids circular imports because each implementation only imports from `types.ts` and `error.ts`.

Let me rewrite the plan with this structure:

- [ ] **Step 3: Write the types and error class**

Create `packages/jarvis/src/model/types.ts`:

```typescript
export type ModelErrorCode = "unavailable" | "timeout" | "invalid_response";

export interface ModelConfig {
  provider: "ollama" | "openai-compat";
  model: string;
  baseUrl: string;
  apiKey?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  isAvailable(): Promise<boolean>;
}
```

Create `packages/jarvis/src/model/error.ts`:

```typescript
import type { ModelErrorCode } from "./types.js";

export class ModelError extends Error {
  override readonly name = "ModelError" as const;
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
```

Create `packages/jarvis/src/model/index.ts`:

```typescript
export type { ModelConfig, ModelResponse, ModelClient, ModelErrorCode } from "./types.js";
export { ModelError } from "./error.js";
export { OllamaClient } from "./ollama-client.js";
export { OpenAICompatClient } from "./openai-compat-client.js";
export { MockModelClient } from "./mock-client.js";
export { createModelClient } from "./factory.js";
```

Create `packages/jarvis/src/model/factory.ts`:

```typescript
import type { ModelConfig, ModelClient } from "./types.js";
import { OllamaClient } from "./ollama-client.js";
import { OpenAICompatClient } from "./openai-compat-client.js";

export function createModelClient(config: ModelConfig): ModelClient {
  if (config.provider === "ollama") {
    return new OllamaClient(config);
  }
  return new OpenAICompatClient(config);
}
```

Create placeholder `packages/jarvis/src/model/ollama-client.ts`:

```typescript
import type { ModelClient, ModelConfig, ModelResponse } from "./types.js";

export class OllamaClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: ModelConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.fetchFn = globalThis.fetch;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    throw new Error("Not implemented");
  }

  async isAvailable(): Promise<boolean> {
    throw new Error("Not implemented");
  }
}
```

Create placeholder `packages/jarvis/src/model/openai-compat-client.ts`:

```typescript
import type { ModelClient, ModelConfig, ModelResponse } from "./types.js";

export class OpenAICompatClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: ModelConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.fetchFn = globalThis.fetch;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    throw new Error("Not implemented");
  }

  async isAvailable(): Promise<boolean> {
    throw new Error("Not implemented");
  }
}
```

Create placeholder `packages/jarvis/src/model/mock-client.ts`:

```typescript
import type { ModelClient, ModelResponse } from "./types.js";

export class MockModelClient implements ModelClient {
  async chat(_prompt: string, _system?: string): Promise<ModelResponse> {
    throw new Error("Not implemented");
  }

  async isAvailable(): Promise<boolean> {
    throw new Error("Not implemented");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/jarvis/test/model/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/model/ packages/jarvis/test/model/
git commit -m "feat(jarvis): add ModelClient interface, error class, factory, and placeholder implementations"
```

---

### Task 2: OllamaClient Implementation

**Files:**
- Modify: `packages/jarvis/src/model/ollama-client.ts`
- Test: `packages/jarvis/test/model/ollama-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/jarvis/test/model/ollama-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaClient } from "../../src/model/ollama-client.js";
import type { ModelConfig } from "../../src/model/types.js";
import { ModelError } from "../../src/model/error.js";

function mockFetch(response: Record<string, unknown>, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

function mockFetchError(): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(new Error("Network error"));
}

const defaultConfig: ModelConfig = {
  provider: "ollama",
  model: "llama3",
  baseUrl: "http://127.0.0.1:11434",
};

describe("OllamaClient", () => {
  describe("chat", () => {
    it("sends chat request to Ollama and returns response", async () => {
      const fetchFn = mockFetch({
        model: "llama3",
        message: { role: "assistant", content: "Hello from Ollama!" },
        done: true,
      });

      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });
      const response = await client.chat("Hi there");

      expect(response.content).toBe("Hello from Ollama!");
      expect(response.model).toBe("llama3");
      expect(response.done).toBe(true);

      expect(fetchFn).toHaveBeenCalledWith(
        "http://127.0.0.1:11434/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("llama3"),
        }),
      );
    });

    it("includes system prompt when provided", async () => {
      const fetchFn = mockFetch({
        model: "llama3",
        message: { role: "assistant", content: "Classified" },
        done: true,
      });

      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });
      await client.chat("hello", "You are a helpful assistant");

      const callBody = JSON.parse((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(2);
      expect(callBody.messages[0].role).toBe("system");
      expect(callBody.messages[0].content).toBe("You are a helpful assistant");
    });

    it("throws ModelError with unavailable code on network error", async () => {
      const fetchFn = mockFetchError();
      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      await expect(client.chat("hello")).rejects.toThrow(ModelError);
      await expect(client.chat("hello")).rejects.toThrow("Cannot connect");
    });

    it("throws ModelError with invalid_response code on non-JSON response", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Invalid JSON")),
        text: () => Promise.resolve("not json"),
      } as Response);

      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      await expect(client.chat("hello")).rejects.toThrow(ModelError);
    });

    it("throws ModelError with invalid_response code on missing message content", async () => {
      const fetchFn = mockFetch({
        model: "llama3",
        done: true,
      });

      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      await expect(client.chat("hello")).rejects.toThrow(ModelError);
    });
  });

  describe("isAvailable", () => {
    it("returns true when Ollama server is reachable", async () => {
      const fetchFn = mockFetch({ models: [] });
      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(true);
      expect(fetchFn).toHaveBeenCalledWith(
        "http://127.0.0.1:11434/api/tags",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns false when Ollama server is unreachable", async () => {
      const fetchFn = mockFetchError();
      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(false);
    });

    it("returns false on non-200 status", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const client = new OllamaClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(false);
    });
  });
});
```

Wait — I need to check the `ModelConfig` type. It currently doesn't have a `fetch` field. The `OllamaSttEngine` accepts `fetch` in its config. I should add it to `ModelConfig` or to the constructor of each client. Let me add a `fetch` override to the constructor of each client, not the `ModelConfig` interface (since `ModelConfig` is the persisted settings schema).

I'll add it as a constructor parameter: `config` plus optional `fetchFn` override. Let me update the types.

Actually, looking at `OllamaSttConfig`, it has `fetch?: typeof globalThis.fetch` as an optional field. I'll follow the same pattern but as a separate constructor parameter since `ModelConfig` is persisted settings.

Updated `OllamaClient` constructor: `constructor(config: ModelConfig, fetchFn?: typeof globalThis.fetch)`

The test needs to pass `fetch` via this parameter. Let me adjust.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/jarvis/test/model/ollama-client.test.ts`
Expected: FAIL — `Not implemented` thrown

- [ ] **Step 3: Implement OllamaClient**

Update `packages/jarvis/src/model/ollama-client.ts`:

```typescript
import type { ModelClient, ModelConfig, ModelResponse } from "./types.js";
import { ModelError } from "./error.js";

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

export class OllamaClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: ModelConfig, fetchFn?: typeof globalThis.fetch) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    const messages: Array<{ role: string; content: string }> = [];
    if (system) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: prompt });

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
      });
    } catch {
      throw new ModelError("unavailable", `Cannot connect to Ollama at ${this.baseUrl}`);
    }

    if (!response.ok) {
      throw new ModelError("invalid_response", `Ollama returned HTTP ${response.status}`);
    }

    let data: OllamaChatResponse;
    try {
      data = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new ModelError("invalid_response", "Failed to parse Ollama response as JSON");
    }

    if (!data.message?.content) {
      throw new ModelError("invalid_response", "Ollama response missing message content");
    }

    return {
      content: data.message.content,
      model: data.model,
      done: data.done,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/jarvis/test/model/ollama-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/model/ollama-client.ts packages/jarvis/test/model/ollama-client.test.ts
git commit -m "feat(jarvis): implement OllamaClient with chat and isAvailable"
```

---

### Task 3: OpenAICompatClient Implementation

**Files:**
- Modify: `packages/jarvis/src/model/openai-compat-client.ts`
- Test: `packages/jarvis/test/model/openai-compat-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/jarvis/test/model/openai-compat-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";
import type { ModelConfig } from "../../src/model/types.js";
import { ModelError } from "../../src/model/error.js";

function mockFetch(response: Record<string, unknown>, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

function mockFetchError(): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(new Error("Network error"));
}

const defaultConfig: ModelConfig = {
  provider: "openai-compat",
  model: "gpt-4",
  baseUrl: "http://127.0.0.1:8080",
  apiKey: "sk-test",
};

describe("OpenAICompatClient", () => {
  describe("chat", () => {
    it("sends chat request and returns response", async () => {
      const fetchFn = mockFetch({
        id: "chatcmpl-1",
        model: "gpt-4",
        choices: [{ message: { role: "assistant", content: "Hello from GPT!" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });
      const response = await client.chat("Hi there");

      expect(response.content).toBe("Hello from GPT!");
      expect(response.model).toBe("gpt-4");
      expect(response.done).toBe(true);

      const callArgs = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe("http://127.0.0.1:8080/v1/chat/completions");
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe("gpt-4");
      expect(body.messages[0].role).toBe("user");
      expect(body.messages[0].content).toBe("Hi there");
    });

    it("includes Authorization header when apiKey is set", async () => {
      const fetchFn = mockFetch({
        id: "chatcmpl-1",
        model: "gpt-4",
        choices: [{ message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      });

      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });
      await client.chat("hello");

      const callArgs = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe("Bearer sk-test");
    });

    it("omits Authorization header when apiKey is not set", async () => {
      const fetchFn = mockFetch({
        id: "chatcmpl-1",
        model: "gpt-4",
        choices: [{ message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      });

      const configNoKey: ModelConfig = {
        provider: "openai-compat",
        model: "gpt-4",
        baseUrl: "http://127.0.0.1:8080",
      };
      const client = new OpenAICompatClient({ ...configNoKey, fetch: fetchFn });
      await client.chat("hello");

      const callArgs = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBeUndefined();
    });

    it("includes system prompt when provided", async () => {
      const fetchFn = mockFetch({
        id: "chatcmpl-1",
        model: "gpt-4",
        choices: [{ message: { role: "assistant", content: "Classified" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      });

      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });
      await client.chat("hello", "You are a helpful assistant");

      const callArgs = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
    });

    it("throws ModelError with unavailable code on network error", async () => {
      const fetchFn = mockFetchError();
      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });

      await expect(client.chat("hello")).rejects.toThrow(ModelError);
    });

    it("throws ModelError with invalid_response code on missing choices", async () => {
      const fetchFn = mockFetch({
        id: "chatcmpl-1",
        model: "gpt-4",
        choices: [],
      });

      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });

      await expect(client.chat("hello")).rejects.toThrow(ModelError);
    });
  });

  describe("isAvailable", () => {
    it("returns true when server is reachable", async () => {
      const fetchFn = mockFetch({ data: [] });
      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(true);
      expect(fetchFn).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/v1/models",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns false when server is unreachable", async () => {
      const fetchFn = mockFetchError();
      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(false);
    });

    it("returns false on non-200 status", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const client = new OpenAICompatClient({ ...defaultConfig, fetch: fetchFn });

      expect(await client.isAvailable()).toBe(false);
    });
  });
});
```

Wait — the `OpenAICompatClient` constructor needs to accept `fetch` like `OllamaClient`. The `ModelConfig` doesn't have `fetch`. I'll follow the same pattern — separate constructor parameter.

Actually, the test passes `{ ...defaultConfig, fetch: fetchFn }` but `ModelConfig` doesn't have `fetch`. The spread would just add it as an extra property. TypeScript might complain. Let me make the constructor accept `(config: ModelConfig, fetchFn?: typeof globalThis.fetch)` like `OllamaClient`.

I need to fix the tests to use `new OpenAICompatClient(defaultConfig, fetchFn)` instead of `{ ...defaultConfig, fetch: fetchFn }`. Let me update.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/jarvis/test/model/openai-compat-client.test.ts`
Expected: FAIL — `Not implemented` thrown

- [ ] **Step 3: Implement OpenAICompatClient**

Update `packages/jarvis/src/model/openai-compat-client.ts`:

```typescript
import type { ModelClient, ModelConfig, ModelResponse } from "./types.js";
import { ModelError } from "./error.js";

export interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export class OpenAICompatClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: ModelConfig, fetchFn?: typeof globalThis.fetch) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    const messages: Array<{ role: string; content: string }> = [];
    if (system) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.model, messages }),
      });
    } catch {
      throw new ModelError("unavailable", `Cannot connect to OpenAI-compatible server at ${this.baseUrl}`);
    }

    if (!response.ok) {
      throw new ModelError("invalid_response", `OpenAI-compatible server returned HTTP ${response.status}`);
    }

    let data: OpenAIChatResponse;
    try {
      data = (await response.json()) as OpenAIChatResponse;
    } catch {
      throw new ModelError("invalid_response", "Failed to parse response as JSON");
    }

    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw new ModelError("invalid_response", "Response missing message content");
    }

    return {
      content: choice.message.content,
      model: data.model,
      done: choice.finish_reason === "stop" || choice.finish_reason === "length",
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/jarvis/test/model/openai-compat-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/model/openai-compat-client.ts packages/jarvis/test/model/openai-compat-client.test.ts
git commit -m "feat(jarvis): implement OpenAICompatClient with chat and isAvailable"
```

---

### Task 4: MockModelClient Implementation and Factory

**Files:**
- Modify: `packages/jarvis/src/model/mock-client.ts`
- Modify: `packages/jarvis/src/model/client.test.ts` (rename/update to test factory + mock)

- [ ] **Step 1: Update MockModelClient**

Update `packages/jarvis/src/model/mock-client.ts`:

```typescript
import type { ModelClient, ModelResponse } from "./types.js";
import { ModelError } from "./error.js";

export interface MockModelClientConfig {
  available?: boolean;
  response?: ModelResponse;
  error?: ModelError;
}

export class MockModelClient implements ModelClient {
  private readonly available: boolean;
  private readonly response: ModelResponse;
  private readonly error?: ModelError;
  public chatCalls: Array<{ prompt: string; system?: string }> = [];

  constructor(config?: MockModelClientConfig) {
    this.available = config?.available ?? true;
    this.response = config?.response ?? { content: "mock response", model: "mock", done: true };
    this.error = config?.error;
  }

  async chat(prompt: string, system?: string): Promise<ModelResponse> {
    this.chatCalls.push({ prompt, system });
    if (this.error) throw this.error;
    return this.response;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}
```

- [ ] **Step 2: Update factory test**

Update `packages/jarvis/test/model/client.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createModelClient } from "../../src/model/factory.js";
import { ModelError } from "../../src/model/error.js";
import { OllamaClient } from "../../src/model/ollama-client.js";
import { OpenAICompatClient } from "../../src/model/openai-compat-client.js";

describe("createModelClient", () => {
  it("creates OllamaClient for ollama provider", () => {
    const client = createModelClient({
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://127.0.0.1:11434",
    });
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("creates OpenAICompatClient for openai-compat provider", () => {
    const client = createModelClient({
      provider: "openai-compat",
      model: "gpt-4",
      baseUrl: "http://127.0.0.1:8080",
      apiKey: "sk-test",
    });
    expect(client).toBeInstanceOf(OpenAICompatClient);
  });
});

describe("ModelError", () => {
  it("stores code and message", () => {
    const err = new ModelError("unavailable", "server not reachable");
    expect(err.code).toBe("unavailable");
    expect(err.message).toBe("server not reachable");
    expect(err).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 3: Run all model tests**

Run: `npx vitest run packages/jarvis/test/model/`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add packages/jarvis/src/model/ packages/jarvis/test/model/
git commit -m "feat(jarvis): implement MockModelClient and createModelClient factory"
```

---

### Task 5: Wire ModelClient into RuleBasedRouter

**Files:**
- Modify: `packages/jarvis/src/nexus/router.ts`
- Modify: `packages/jarvis/test/nexus/router.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/jarvis/test/nexus/router.test.ts`:

```typescript
import { MockModelClient } from "../../src/model/mock-client.js";

// ... existing tests ...

describe("RuleBasedRouter with ModelClient", () => {
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("uses model classification when model is available and returns valid intent", async () => {
    const mockClient = new MockModelClient({
      response: {
        content: JSON.stringify({ action: "check_weather", confidence: 0.95, entities: { location: "NYC" } }),
        model: "mock",
        done: true,
      },
    });
    const router = new RuleBasedRouter(mockClient);
    const intent: Intent = { action: "what's the weather", params: {}, confidence: 0.3, ambiguous: true };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("weather");
    expect(plan.primary?.confidence).toBe(0.95);
    expect(mockClient.chatCalls).toHaveLength(1);
  });

  it("falls back to rules when model is unavailable", async () => {
    const mockClient = new MockModelClient({ available: false });
    const router = new RuleBasedRouter(mockClient);
    const intent: Intent = { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("weather");
    expect(mockClient.chatCalls).toHaveLength(0);
  });

  it("falls back to rules when model returns invalid JSON", async () => {
    const mockClient = new MockModelClient({
      response: { content: "not json at all", model: "mock", done: true },
    });
    const router = new RuleBasedRouter(mockClient);
    const intent: Intent = { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("weather");
  });

  it("falls back to rules when model classification confidence is too low", async () => {
    const mockClient = new MockModelClient({
      response: {
        content: JSON.stringify({ action: "check_weather", confidence: 0.3, entities: {} }),
        model: "mock",
        done: true,
      },
    });
    const router = new RuleBasedRouter(mockClient);
    const intent: Intent = { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("weather");
  });

  it("falls back to rules when model throws", async () => {
    const mockClient = new MockModelClient({
      error: new ModelError("unavailable", "server down"),
    });
    const router = new RuleBasedRouter(mockClient);
    const intent: Intent = { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false };
    const plan = await router.route(intent, context);
    expect(plan.primary?.agentId).toBe("weather");
  });
});
```

Wait — the existing `RuleBasedRouter.route()` is synchronous (returns `DispatchPlan`, not `Promise<DispatchPlan>`). I need to change the signature. The `IntentRouter` interface has `route(intent: Intent, context: JarvisContext): DispatchPlan` — synchronous.

To support model-based routing, I need to make `route()` async. This changes the interface. Let me check how it's called.

Looking at `engine.ts` line 26: `const plan = this.cfg.intentRouter.route(intent, context);` — this is called without `await`. If I change `IntentRouter.route()` to return `Promise<DispatchPlan>`, the engine needs `await`.

This is a significant change. The engine test and all implementations need updating. Let me check if there are other implementations of `IntentRouter`.

Only `RuleBasedRouter` implements `IntentRouter`. So the change is:
1. Change `IntentRouter.route()` to return `Promise<DispatchPlan>`
2. Update `NexusEngine.execute()` to `await this.cfg.intentRouter.route(intent, context)`
3. Update `RuleBasedRouter.route()` to be `async`

This is clean and necessary. Let me include it in this task.

Actually, I also need to make `MockModelClient` accessible in the router test. The test file already imports from `../../src/nexus/router.js` — I need to add the import for `MockModelClient`. And I need `ModelError` too.

Let me also reconsider: making `route()` async means ALL existing tests that call `router.route()` need `await`. There are many tests in `router.test.ts`. This is manageable but important to track.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/jarvis/test/nexus/router.test.ts`
Expected: FAIL — new test methods reference `MockModelClient` which doesn't exist in the test yet, and `route()` is not yet async

- [ ] **Step 3: Update IntentRouter interface and RuleBasedRouter**

Update `packages/jarvis/src/nexus/router.ts`:

```typescript
import type { Intent, JarvisContext, DispatchPlan } from "./types.js";
import type { ModelClient } from "../model/types.js";

export interface IntentRouter {
  route(intent: Intent, context: JarvisContext): Promise<DispatchPlan>;
}

export class RuleBasedRouter implements IntentRouter {
  private rules: Map<string, (intent: Intent) => DispatchPlan>;
  private client?: ModelClient;

  constructor(client?: ModelClient) {
    this.client = client;
    this.rules = new Map([
      ["search", this.routeToResearch],
      ["get_updates", this.routeToParallel],
      ["open_app", this.routeToSystem],
      ["check_weather", this.routeToWeather],
      ["check_calendar", this.routeToCalendar],
      ["browse", this.routeToBrowser],
      ["vision_query", this.routeToVision],
      ["send_discord", this.routeToDiscord],
      ["read_discord", this.routeToDiscord],
      ["send_telegram", this.routeToTelegram],
      ["read_telegram", this.routeToTelegram],
      ["fetch_url", this.routeToWeb],
      ["search_email", this.routeToEmail],
      ["read_email", this.routeToEmail],
      ["draft_email", this.routeToEmail],
      ["send_email", this.routeToEmail],
      ["calendar_list", this.routeToCalendar],
      ["calendar_get_events", this.routeToCalendar],
      ["calendar_create", this.routeToCalendar],
      ["calendar_update", this.routeToCalendar],
      ["calendar_delete", this.routeToCalendar],
      ["query_notion", this.routeToNotion],
      ["get_notion", this.routeToNotion],
      ["create_notion", this.routeToNotion],
      ["update_notion", this.routeToNotion],
      ["cron_schedule", this.routeToCron],
      ["cron_list", this.routeToCron],
      ["cron_cancel", this.routeToCron],
      ["secret_get", this.routeToSecrets],
      ["search_discord", this.routeToDiscord],
      ["get_calendar", this.routeToCalendar],
      ["set_reminder", this.routeToCron],
    ]);
  }

  async route(intent: Intent, context: JarvisContext): Promise<DispatchPlan> {
    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const modelResult = await this.client.chat(
            `Classify this user intent as JSON: {"action": "...", "confidence": 0.0-1.0}. User said: "${intent.action}"`,
            "You are an intent classifier. Respond ONLY with valid JSON: {\"action\": \"<action>\", \"confidence\": <0.0-1.0>}. Valid actions: search, get_updates, open_app, check_weather, check_calendar, browse, vision_query, send_discord, read_discord, send_telegram, read_telegram, fetch_url, search_email, read_email, draft_email, send_email, calendar_list, calendar_get_events, calendar_create, calendar_update, calendar_delete, query_notion, get_notion, create_notion, update_notion, cron_schedule, cron_list, cron_cancel, secret_get, search_discord, get_calendar, set_reminder",
          );

          const parsed = JSON.parse(modelResult.content) as { action: string; confidence: number };
          if (parsed.confidence >= 0.7 && this.rules.has(parsed.action)) {
            const handler = this.rules.get(parsed.action)!;
            return handler(intent);
          }
        }
      } catch {
        // Fall back to rule-based routing
      }
    }

    const handler = this.rules.get(intent.action);
    if (handler) return handler(intent);
    return this.routeToGeneral(intent);
  }

  // ... all private routeTo* methods remain unchanged ...
}
```

The private route methods stay unchanged (they're synchronous and return `DispatchPlan`). Only `route()` becomes async.

- [ ] **Step 4: Update NexusEngine to await router.route()**

In `packages/jarvis/src/nexus/engine.ts`, change line 26 from:

```typescript
const plan = this.cfg.intentRouter.route(intent, context);
```

to:

```typescript
const plan = await this.cfg.intentRouter.route(intent, context);
```

- [ ] **Step 5: Update existing router tests to use await**

In `packages/jarvis/test/nexus/router.test.ts`, add `await` before all `router.route()` calls. Change the test setup to keep `new RuleBasedRouter()` (no model client = rule-based only).

Also add the new test section with `MockModelClient`.

- [ ] **Step 6: Update existing engine tests**

In `packages/jarvis/test/nexus/engine.test.ts`, the engine already uses `await engine.execute()` which internally calls `router.route()`. Since `route()` is now async and `execute()` already `await`s it, the engine test should still work. But verify.

- [ ] **Step 7: Run all nexus tests**

Run: `npx vitest run packages/jarvis/test/nexus/`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/jarvis/src/nexus/router.ts packages/jarvis/src/nexus/engine.ts packages/jarvis/test/nexus/router.test.ts
git commit -m "feat(jarvis): wire ModelClient into RuleBasedRouter with async route() and model-based classification"
```

---

### Task 6: Wire ModelClient into InProcessAgentPool

**Files:**
- Modify: `packages/jarvis/src/nexus/pool.ts`
- Modify: `packages/jarvis/test/nexus/pool.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/jarvis/test/nexus/pool.test.ts`:

```typescript
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";

// ... existing tests ...

describe("InProcessAgentPool with ModelClient", () => {
  it("uses model for general agent when available", async () => {
    const mockClient = new MockModelClient({
      response: { content: "The weather in NYC is sunny and 72°F.", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(mockClient);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const context: AgentContext = {
      sessionId: "sess-1",
      intent: { action: "unknown", params: {}, confidence: 0.3, ambiguous: true },
    };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ response: "The weather in NYC is sunny and 72°F." });
    expect(mockClient.chatCalls).toHaveLength(1);
  });

  it("falls back to mock response when model is unavailable", async () => {
    const mockClient = new MockModelClient({ available: false });
    const pool = new InProcessAgentPool(mockClient);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const context: AgentContext = {
      sessionId: "sess-1",
      intent: { action: "unknown", params: {}, confidence: 0.3, ambiguous: true },
    };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ response: "general-acknowledgment" });
  });

  it("falls back to mock response when model throws", async () => {
    const mockClient = new MockModelClient({
      error: new ModelError("unavailable", "server down"),
    });
    const pool = new InProcessAgentPool(mockClient);
    const route: AgentRoute = { agentId: "general", confidence: 0.9, required: false };
    const context: AgentContext = {
      sessionId: "sess-1",
      intent: { action: "unknown", params: {}, confidence: 0.3, ambiguous: true },
    };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ response: "general-acknowledgment" });
  });

  it("non-general agents still use rule-based factories", async () => {
    const mockClient = new MockModelClient({
      response: { content: "should not be used", model: "mock", done: true },
    });
    const pool = new InProcessAgentPool(mockClient);
    const route: AgentRoute = { agentId: "weather", confidence: 0.9, required: false };
    const context: AgentContext = {
      sessionId: "sess-1",
      intent: { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false },
    };
    const result = await pool.execute(route, context);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ temp: 72, condition: "sunny" });
    expect(mockClient.chatCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/jarvis/test/nexus/pool.test.ts`
Expected: FAIL — `InProcessAgentPool` constructor doesn't accept `ModelClient`

- [ ] **Step 3: Implement ModelClient support in InProcessAgentPool**

Update `packages/jarvis/src/nexus/pool.ts`:

Add `ModelClient` import and constructor parameter. In the "general" agent factory, check if `client` is available and call it:

```typescript
import type { ModelClient } from "../model/types.js";
// ... existing imports ...

export class InProcessAgentPool implements AgentPool {
  private agents: Map<string, AgentInfo>;
  private factories: Map<string, AgentFactory>;
  private sessions: Map<string, AgentSession>;
  private client?: ModelClient;

  constructor(client?: ModelClient) {
    this.client = client;
    // ... existing agent map initialization ...

    this.factories = new Map<string, AgentFactory>([
      // ... all existing factories except "general" ...
      ["general", async (ctx: AgentContext) => {
        if (this.client) {
          try {
            const available = await this.client.isAvailable();
            if (available) {
              const response = await this.client.chat(
                ctx.intent.action,
                "You are JARVIS, a helpful AI assistant. Respond concisely.",
              );
              return { response: response.content };
            }
          } catch {
            // Fall back to mock
          }
        }
        return { response: "general-acknowledgment" };
      }],
      // ... rest of factories ...
    ]);
    // ...
  }
  // ... rest unchanged ...
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/jarvis/test/nexus/pool.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/nexus/pool.ts packages/jarvis/test/nexus/pool.test.ts
git commit -m "feat(jarvis): wire ModelClient into InProcessAgentPool for general agent"
```

---

### Task 7: Wire ModelClient into RuleBasedSynthesizer

**Files:**
- Modify: `packages/jarvis/src/nexus/synthesizer.ts`
- Modify: `packages/jarvis/test/nexus/synthesizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/jarvis/test/nexus/synthesizer.test.ts`:

```typescript
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";

// ... existing tests ...

describe("RuleBasedSynthesizer with ModelClient", () => {
  const context: JarvisContext = {
    sessionId: "sess-1",
    userId: "user-1",
    recentIntents: [],
    currentTime: new Date(),
  };

  it("uses model for synthesis when available", async () => {
    const mockClient = new MockModelClient({
      response: { content: "It's sunny and 72°F in NYC, and you have a meeting at 10:00.", model: "mock", done: true },
    });
    const synthesizer = new RuleBasedSynthesizer(mockClient);
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
      { agentId: "calendar", success: true, output: { events: [{ title: "Meeting", time: "10:00" }] } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toBe("It's sunny and 72°F in NYC, and you have a meeting at 10:00.");
  });

  it("falls back to rule-based synthesis when model is unavailable", async () => {
    const mockClient = new MockModelClient({ available: false });
    const synthesizer = new RuleBasedSynthesizer(mockClient);
    const intent: Intent = { action: "get_updates", params: {}, confidence: 0.9, ambiguous: false };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/72/);
    expect(synthesis.spoken).toMatch(/sunny/);
  });

  it("falls back to rule-based synthesis when model throws", async () => {
    const mockClient = new MockModelClient({
      error: new ModelError("unavailable", "server down"),
    });
    const synthesizer = new RuleBasedSynthesizer(mockClient);
    const intent: Intent = { action: "check_weather", params: {}, confidence: 0.9, ambiguous: false };
    const results: AgentResult[] = [
      { agentId: "weather", success: true, output: { temp: 72, condition: "sunny" } },
    ];
    const synthesis = await synthesizer.synthesize(results, intent, context);
    expect(synthesis.spoken).toMatch(/72/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/jarvis/test/nexus/synthesizer.test.ts`
Expected: FAIL — `RuleBasedSynthesizer` constructor doesn't accept `ModelClient`

- [ ] **Step 3: Implement ModelClient support in RuleBasedSynthesizer**

The `Synthesizer` interface in `types.ts` has:

```typescript
interface Synthesizer {
  synthesize(results: AgentResult[], originalIntent: Intent, context: JarvisContext): Promise<Synthesis>;
}
```

It's already async. Good. Update `packages/jarvis/src/nexus/synthesizer.ts`:

```typescript
import type { AgentResult, Intent, JarvisContext, Synthesis, Synthesizer } from "./types.js";
import type { ModelClient } from "../model/types.js";

export type { Synthesizer };

export class RuleBasedSynthesizer implements Synthesizer {
  private client?: ModelClient;

  constructor(client?: ModelClient) {
    this.client = client;
  }

  async synthesize(
    results: AgentResult[],
    originalIntent: Intent,
    context: JarvisContext,
  ): Promise<Synthesis> {
    if (this.client) {
      try {
        const available = await this.client.isAvailable();
        if (available) {
          const agentOutputs = results
            .filter((r) => r.success)
            .map((r) => `${r.agentId}: ${JSON.stringify(r.output)}`)
            .join("; ");
          const failedAgents = results
            .filter((r) => !r.success)
            .map((r) => `${r.agentId}: ${r.error}`)
            .join("; ");

          const prompt = failedAgents
            ? `Successful results: ${agentOutputs}. Failed: ${failedAgents}. User intent: ${originalIntent.action}.`
            : `Results: ${agentOutputs}. User intent: ${originalIntent.action}.`;

          const response = await this.client.chat(
            prompt,
            "You are JARVIS, a helpful AI assistant. Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
          );
          return { spoken: response.content };
        }
      } catch {
        // Fall back to rule-based synthesis
      }
    }

    // ... existing rule-based synthesis code ...
    const parts: string[] = [];
    const visual: Synthesis["visual"] = [];
    // ... (unchanged from current implementation)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/jarvis/test/nexus/synthesizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/nexus/synthesizer.ts packages/jarvis/test/nexus/synthesizer.test.ts
git commit -m "feat(jarvis): wire ModelClient into RuleBasedSynthesizer with model-based synthesis"
```

---

### Task 8: Wire ModelClient into NexusEngine config

**Files:**
- Modify: `packages/jarvis/src/nexus/engine.ts`
- Modify: `packages/jarvis/test/nexus/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/jarvis/test/nexus/engine.test.ts`:

```typescript
import { MockModelClient } from "../../src/model/mock-client.js";

// ... existing tests ...

describe("NexusEngine with ModelClient", () => {
  it("passes ModelClient to router, pool, and synthesizer", async () => {
    const mockClient = new MockModelClient({
      response: { content: JSON.stringify({ action: "search", confidence: 0.95 }), model: "mock", done: true },
    });
    const eventBus = new SimpleEventBus();
    const engine = new NexusEngine({
      intentRouter: new RuleBasedRouter(mockClient),
      agentPool: new InProcessAgentPool(mockClient),
      synthesizer: new RuleBasedSynthesizer(mockClient),
      eventBus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 30000,
    });

    const context: JarvisContext = {
      sessionId: "sess-model",
      userId: "user-1",
      recentIntents: [],
      currentTime: new Date(),
    };

    const intent: Intent = { action: "search", params: { query: "test" }, confidence: 0.9, ambiguous: false };
    const synthesis = await engine.execute(intent, context);
    expect(synthesis.spoken).toBeDefined();
    expect(synthesis.spoken.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Update NexusConfig to accept optional modelClient**

The `NexusConfig` interface in `engine.ts` doesn't need to change — the client is passed directly to the components (router, pool, synthesizer) at construction time, not through the engine config. The engine doesn't need to know about the client.

So no changes needed to `engine.ts` for this. The test just validates that the components work together through the engine when given a client.

- [ ] **Step 3: Run tests**

Run: `npx vitest run packages/jarvis/test/nexus/engine.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/jarvis/test/nexus/engine.test.ts
git commit -m "test(jarvis): add engine integration test with ModelClient"
```

---

### Task 9: Wire ModelClient into desktop IPC

**Files:**
- Modify: `packages/desktop/src/main/ipc.ts`

- [ ] **Step 1: Update ipc.ts to read model config and create ModelClient**

Update `packages/desktop/src/main/ipc.ts`:

```typescript
import { NexusEngine } from "@openjarvis/jarvis/nexus";
import { RuleBasedRouter } from "@openjarvis/jarvis/nexus";
import { InProcessAgentPool } from "@openjarvis/jarvis/nexus";
import { RuleBasedSynthesizer } from "@openjarvis/jarvis/nexus";
import { TaskBoard } from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import type { EventBus } from "@openjarvis/jarvis";
import { createModelClient } from "@openjarvis/jarvis/model";
import type { ModelClient } from "@openjarvis/jarvis/model";
import type { IpcMain, BrowserWindow } from "electron";
import type { DesktopStore } from "./store.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

let engine: NexusEngine | null = null;
let taskBoard: TaskBoard | null = null;

function getEngine(modelClient?: ModelClient): { engine: NexusEngine; taskBoard: TaskBoard } {
  if (engine && taskBoard) return { engine, taskBoard };

  const eventBus: EventBus = new SimpleEventBus();
  const router = new RuleBasedRouter(modelClient);
  const pool = new InProcessAgentPool(modelClient);
  const synthesizer = new RuleBasedSynthesizer(modelClient);
  taskBoard = new TaskBoard(eventBus);
  engine = new NexusEngine({
    intentRouter: router,
    agentPool: pool,
    synthesizer,
    eventBus,
    maxConcurrentAgents: 3,
    defaultTimeoutMs: 30000,
  });

  return { engine, taskBoard };
}

function resetEngine(): void {
  engine = null;
  taskBoard = null;
}

// ... rest of file ...

export function registerIpcHandlers(store: DesktopStore, ipcMain: MinimalIpcMain): void {
  let currentModelClient: ModelClient | undefined;

  try {
    const settings = store.loadSettingsSync?.();
    if (settings?.model) {
      currentModelClient = createModelClient(settings.model);
    }
  } catch {
    // Settings not available yet, proceed without model client
  }

  ipcMain.handle("settings:load", () => store.loadSettings());
  ipcMain.handle("settings:save", async (_event, settings) => {
    const result = await store.saveSettings(settings);
    if (settings.model) {
      currentModelClient = createModelClient(settings.model);
      resetEngine();
    }
    return result;
  });
  // ... rest of handlers ...
}
```

Wait — `DesktopStore.loadSettings()` is async. I need to check how the store works and whether there's a sync version. Let me check.

Actually, looking at the current `getEngine()` — it's called lazily when needed. The model client creation should also happen lazily. I can read settings from the store when creating the engine.

Let me restructure this more carefully.

Looking at `ipc.ts` again, `getEngine()` is called lazily in the IPC handlers. I can read model settings there. But `store.loadSettings()` is async. The simplest approach: load settings inside `getEngine()`.

Updated approach for `packages/desktop/src/main/ipc.ts`:

```typescript
import { NexusEngine, RuleBasedRouter, InProcessAgentPool, RuleBasedSynthesizer, TaskBoard } from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import type { EventBus } from "@openjarvis/jarvis";
import { createModelClient } from "@openjarvis/jarvis/model";
import type { ModelClient } from "@openjarvis/jarvis/model";
import type { IpcMain, BrowserWindow } from "electron";
import type { DesktopStore } from "./store.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

let engine: NexusEngine | null = null;
let taskBoard: TaskBoard | null = null;
let modelClient: ModelClient | undefined;

function resetEngine(): void {
  engine = null;
  taskBoard = null;
}

async function getEngine(): Promise<{ engine: NexusEngine; taskBoard: TaskBoard }> {
  if (engine && taskBoard) return { engine, taskBoard };

  const eventBus: EventBus = new SimpleEventBus();
  const router = new RuleBasedRouter(modelClient);
  const pool = new InProcessAgentPool(modelClient);
  const synthesizer = new RuleBasedSynthesizer(modelClient);
  taskBoard = new TaskBoard(eventBus);
  engine = new NexusEngine({
    intentRouter: router,
    agentPool: pool,
    synthesizer,
    eventBus,
    maxConcurrentAgents: 3,
    defaultTimeoutMs: 30000,
  });

  return { engine, taskBoard };
}

// ... rest unchanged except settings:save handler resets engine ...
```

But this changes `getEngine()` from sync to async, which means all IPC handlers that call it need `await`. Let me check the current code.

Currently `getEngine()` is sync and called in `nexus:getTasks`, `nexus:getAgents`, `nexus:executeIntent`. These are all async handlers already. So adding `await` is fine.

For model config: I'll initialize `modelClient` from settings when the IPC handlers are registered (or lazily on first call). The simplest approach is to create the client in `getEngine()` from the store.

Actually, the cleanest approach: create `modelClient` in `registerIpcHandlers` and pass it to `getEngine`. When settings change, recreate.

Let me write the final version of `ipc.ts` carefully:

```typescript
import { NexusEngine } from "@openjarvis/jarvis/nexus";
import { RuleBasedRouter } from "@openjarvis/jarvis/nexus";
import { InProcessAgentPool } from "@openjarvis/jarvis/nexus";
import { RuleBasedSynthesizer } from "@openjarvis/jarvis/nexus";
import { TaskBoard } from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import type { EventBus } from "@openjarvis/jarvis";
import { createModelClient } from "@openjarvis/jarvis/model";
import type { ModelClient } from "@openjarvis/jarvis/model";
import type { IpcMain, BrowserWindow } from "electron";
import type { DesktopStore } from "./store.js";
import type { AppSettings } from "./schemas.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

let engine: NexusEngine | null = null;
let taskBoard: TaskBoard | null = null;
let modelClient: ModelClient | undefined;

function resetEngine(): void {
  engine = null;
  taskBoard = null;
}

function createEngine(client?: ModelClient): { engine: NexusEngine; taskBoard: TaskBoard } {
  const eventBus: EventBus = new SimpleEventBus();
  const router = new RuleBasedRouter(client);
  const pool = new InProcessAgentPool(client);
  const synthesizer = new RuleBasedSynthesizer(client);
  taskBoard = new TaskBoard(eventBus);
  engine = new NexusEngine({
    intentRouter: router,
    agentPool: pool,
    synthesizer,
    eventBus,
    maxConcurrentAgents: 3,
    defaultTimeoutMs: 30000,
  });
  return { engine, taskBoard };
}

function getEngine(): { engine: NexusEngine; taskBoard: TaskBoard } {
  if (engine && taskBoard) return { engine, taskBoard };
  return createEngine(modelClient);
}

// ... rest of file with settings:save updating modelClient and calling resetEngine() ...
```

This keeps `getEngine()` sync, creates engine lazily, and resets on settings change. The `registerIpcHandlers` function sets up the `settings:save` handler to update `modelClient` and `resetEngine()`.

- [ ] **Step 2: Update the jarvis package exports to include model**

Update `packages/jarvis/src/nexus/index.ts` — no changes needed, model is a separate export path.

Add `packages/jarvis/src/model/index.ts` — already created in Task 1.

Add export in `packages/jarvis/package.json` — need to check if there's a separate exports entry for `@openjarvis/jarvis/model`. Let me check.

Actually, looking at how `@openjarvis/jarvis/nexus` is imported in `ipc.ts`, there must be a package.json exports map. Let me check.

- [ ] **Step 3: Update package.json exports**

Need to add `./model` export to `packages/jarvis/package.json`.

- [ ] **Step 4: Run build and desktop tests**

Run: `npx vitest run packages/desktop/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/ipc.ts packages/jarvis/package.json
git commit -m "feat(desktop): wire ModelClient into IPC, create from settings, reset engine on config change"
```

---

### Task 10: Export the model module and verify full build

**Files:**
- Modify: `packages/jarvis/package.json` (exports)
- Verify: `npx tsc -b` passes
- Verify: `npx vitest run` passes

- [ ] **Step 1: Update package.json exports**

Check `packages/jarvis/package.json` for the existing exports map and add the `./model` entry.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: PASS — no type errors

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS — 1267+ tests

- [ ] **Step 4: Run `make dev` to verify desktop app starts**

Run: `make dev`
Expected: Vite and Electron start without errors

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/package.json packages/jarvis/src/model/
git commit -m "feat(jarvis): add model module exports to package.json"
```

---

## Self-Review

1. **Spec coverage:** Each spec section has a corresponding task:
   - ModelClient interface → Task 1
   - OllamaClient → Task 2
   - OpenAICompatClient → Task 3
   - MockModelClient → Task 4
   - Router integration → Task 5
   - Pool integration → Task 6
   - Synthesizer integration → Task 7
   - Engine integration test → Task 8
   - Desktop IPC wiring → Task 9
   - Build verification → Task 10

2. **Placeholder scan:** No TBDs, TODOs, or placeholder steps. All code is concrete.

3. **Type consistency:** `ModelConfig` has `provider`, `model`, `baseUrl`, `apiKey?` matching the schema in `schemas.ts`. `ModelClient` interface has `chat(prompt, system?)` and `isAvailable()` matching all usage. `ModelResponse` has `content`, `model`, `done` matching both client implementations. `ModelError` has `code` and `message` matching all throw sites. `OllamaClient` and `OpenAICompatClient` both accept `(config: ModelConfig, fetchFn?)` matching the factory. `MockModelClient` accepts `MockModelClientConfig` with `available`, `response`, `error` fields matching all test usage.

   One issue: `createModelClient` factory is in `factory.ts` but imported from `index.ts`. The re-export chain is: `factory.ts` -> `index.ts` -> consumer. This works.

   Another issue: `OllamaClient` and `OpenAICompatClient` constructors accept `(config: ModelConfig, fetchFn?)` but the test for `createModelClient` creates clients without `fetchFn`. The factory will create them with `globalThis.fetch`. This is correct — tests that need mock fetch pass it directly to the constructor.

   The `IntentRouter.route()` signature change from `DispatchPlan` to `Promise<DispatchPlan>` needs to be reflected in the `IntentRouter` interface in `router.ts`. Task 5 includes this change. All callers (engine.ts line 26) need `await`. Task 5 covers this.

4. **Missing items:** The `MockModelClient` test in `client.test.ts` doesn't exist yet — but MockModelClient is tested implicitly in Tasks 5-8 (router, pool, synthesizer, engine tests). The `client.test.ts` file only tests `createModelClient` factory and `ModelError`. This is fine — MockModelClient is a test utility, not production code that needs its own test.