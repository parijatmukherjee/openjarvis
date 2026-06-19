# Model Wiring Design

## Problem

The NexusEngine pipeline (router -> pool -> synthesizer) is entirely rule-based. The Settings UI lets users configure a model provider (Ollama or OpenAI-compat), model name, base URL, and API key, but nothing reads that config at runtime. The "general" agent has a `model-call` capability flag but returns hardcoded mock data.

## Decision

Wire the configured model into all three pipeline stages using a `ModelClient` abstraction with graceful fallback to current rule-based behavior when the model is unavailable.

## Scope

- `ModelClient` interface and two implementations (Ollama native, OpenAI-compat)
- Inject `ModelClient` into `RuleBasedRouter`, `InProcessAgentPool`, `RuleBasedSynthesizer`
- Read model config from `DesktopStore` in `ipc.ts`, create appropriate client, pass to engine components
- Recreate engine when model settings change
- Full test coverage with `MockModelClient`

Out of scope: streaming responses, multi-turn conversation memory, tool/function calling, new agent types beyond "general".

## Architecture

```
Settings UI -> DesktopStore -> ipc.ts -> ModelClient
                                      -> NexusEngine
                                           -> RuleBasedRouter(client?)
                                           -> InProcessAgentPool(client?)
                                           -> RuleBasedSynthesizer(client?)
```

Each component receives an optional `ModelClient`. When provided and available, the component uses it. When absent or unavailable, the component falls back to its current rule-based logic.

## Components

### 1. ModelClient Interface

New directory: `packages/jarvis/src/model/`

**`client.ts`** — Interface and factory:

```typescript
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
  if (config.provider === "ollama") return new OllamaClient(config);
  return new OpenAICompatClient(config);
}
```

**`ollama-client.ts`** — Native Ollama API:

- `chat()`: POST `{baseUrl}/api/chat` with `{model, messages: [{role, content}], stream: false}`
- `isAvailable()`: GET `{baseUrl}/api/tags`, return true if 200
- Parse response: `response.message.content`

**`openai-compat-client.ts`** — OpenAI-compatible API:

- `chat()`: POST `{baseUrl}/v1/chat/completions` with `{model, messages: [{role, content}]}` and `Authorization: Bearer {apiKey}` header (if set)
- `isAvailable()`: GET `{baseUrl}/v1/models`, return true if 200
- Parse response: `choices[0].message.content`

Both clients:

- Use native `fetch`
- Catch network errors in `chat()` and throw a `ModelError` with a `code` field (`unavailable`, `timeout`, `invalid_response`)
- `isAvailable()` returns `false` on any error (no throw)

### 2. Router Changes

`RuleBasedRouter` constructor gets optional `client?: ModelClient`.

When `client` is provided and `isAvailable()` returns true:

- Send the user input + system prompt asking for intent classification as JSON (`{action, entities, confidence}`)
- Parse the JSON response
- If parsing succeeds and `confidence >= 0.7`, use the model's classification
- Otherwise fall back to current rule-based routing

When `client` is absent or unavailable, use current rule-based routing unchanged.

### 3. Agent Pool Changes

`InProcessAgentPool` constructor gets optional `client?: ModelClient`.

The "general" agent factory: when `client` is provided and available, call `client.chat()` with the user input + role-specific system prompt. Fall back to `{ response: "general-acknowledgment" }` on failure.

Other agents (weather, calendar, etc.) remain rule-based for now. They can be upgraded individually later.

### 4. Synthesizer Changes

`RuleBasedSynthesizer` constructor gets optional `client?: ModelClient`.

When `client` is provided and available:

- Send agent results + system prompt asking for natural language synthesis
- Use the model's response as `spoken` text
- Fall back to current rule-based formatting on failure

### 5. Config Flow in ipc.ts

`getEngine()` in `ipc.ts`:

1. Read current model settings from `DesktopStore`
2. Call `createModelClient(config)` to create the appropriate client
3. Pass client to `RuleBasedRouter`, `InProcessAgentPool`, `RuleBasedSynthesizer` constructors
4. Create `NexusEngine` with these components

Settings change handler:

- When model settings change (detected via IPC `settings:changed` event), dispose the old engine and call `getEngine()` again to recreate with the new config
- This is simple and avoids complex hot-reload logic

### 6. NexusConfig Update

Add optional `modelClient?: ModelClient` to `NexusConfig`. The engine passes it through to its components. This keeps the engine unaware of model details — it just hands the client to whoever needs it.

### 7. Error Handling

All model calls follow the same pattern:

1. Call `client.isAvailable()` — skip model call if false
2. Try `client.chat()` — fall back on any error
3. Validate response format — fall back on parse failure
4. Use model response — but never block the pipeline on a model failure

`ModelError` types:

- `unavailable` — server not reachable
- `timeout` — request exceeded `defaultTimeoutMs`
- `invalid_response` — response could not be parsed

### 8. Testing

`MockModelClient` for tests:

- Configurable responses
- Configurable availability
- Configurable errors

Existing tests pass unchanged (no `ModelClient` provided = rule-based fallback).

New test cases per component:

- Model available, returns valid response → model response used
- Model unavailable (`isAvailable: false`) → rule-based fallback
- Model available but `chat()` throws → rule-based fallback
- Model returns unparseable response → rule-based fallback

## Files to Create

- `packages/jarvis/src/model/client.ts` — interface, factory, ModelError
- `packages/jarvis/src/model/ollama-client.ts` — OllamaClient
- `packages/jarvis/src/model/openai-compat-client.ts` — OpenAICompatClient
- `packages/jarvis/src/model/mock-client.ts` — MockModelClient
- `packages/jarvis/src/model/index.ts` — barrel export

## Files to Modify

- `packages/jarvis/src/nexus/router.ts` — accept optional `ModelClient`, use for intent classification
- `packages/jarvis/src/nexus/pool.ts` — accept optional `ModelClient`, use for "general" agent
- `packages/jarvis/src/nexus/synth.ts` — accept optional `ModelClient`, use for synthesis
- `packages/jarvis/src/nexus/engine.ts` — accept optional `ModelClient` in `NexusConfig`, pass to components
- `packages/desktop/src/main/ipc.ts` — read model config, create client, inject into engine
- `packages/jarvis/test/nexus/router.test.ts` — add model integration tests
- `packages/jarvis/test/nexus/pool.test.ts` — add model integration tests
- `packages/jarvis/test/nexus/synth.test.ts` — add model integration tests
- `packages/jarvis/test/model/` — client tests (OllamaClient, OpenAICompatClient, MockModelClient)

## No Comments

Per project convention, no comments in code files.
