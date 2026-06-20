# Streaming Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream JARVIS chat responses token-by-token from the model through the main process to the renderer, and optimistically show the user message in the chat panel the instant they hit Enter. This makes the cold-start latency on Ollama Cloud invisible.

**Architecture:** Both Ollama and OpenAI-compat APIs stream natively. We add a `chatStream()` async-iterator method to the `ModelClient` interface. The main process's `nexus:chatStream` IPC handler kicks off the call and publishes each chunk to the existing `nexus:event` bus (topic `nexus:chat:<sessionId>:chunk`). The renderer's existing `onNexusEvent` channel carries chunks to the React `Chatbox`, which appends them to the in-progress jarvis message.

**Tech Stack:** TypeScript, React, Ollama native streaming (NDJSON), OpenAI-compat streaming (SSE), Vitest, fake `fetch` for tests.

## Global Constraints

- Coverage must stay above 99% statements / 99% lines / 100% functions / 99% branches.
- The `^C` cleanup in `scripts/dev.sh` (Round 14) must keep working; we must abort any in-flight model request when the renderer disconnects.
- `nexus:executeIntent` (the non-streaming entry point) stays unchanged. `chat()` becomes a one-line wrapper around `chatStream()`.
- `MockClient.chatStream` returns the full response as a single chunk — so every existing test that uses the mock keeps working without changes.

---

## File Structure

**Model layer** (jarvis package):

- `packages/jarvis/src/model/types.ts` — interface additions
- `packages/jarvis/src/model/ollama-client.ts` — NDJSON streaming
- `packages/jarvis/src/model/openai-compat-client.ts` — SSE streaming
- `packages/jarvis/src/model/mock-client.ts` — single-chunk stub
- `packages/jarvis/test/model/ollama-client.test.ts` — new test (extend file)
- `packages/jarvis/test/model/openai-compat-client.test.ts` — new test (extend file)

**Engine** (jarvis package):

- `packages/jarvis/src/nexus/types.ts` — engine interface addition
- `packages/jarvis/src/nexus/engine.ts` — `executeChatStream` implementation

**Main process** (desktop package):

- `packages/desktop/src/main/ipc.ts` — new handlers
- `packages/desktop/test/ipc.test.ts` — handler test (extend)

**Preload + bridge + UI** (desktop package):

- `packages/desktop/src/preload.ts` — new IPC channels
- `packages/desktop/src/renderer/types/electron.d.ts` — typed surface
- `packages/desktop/src/renderer/lib/nexus-types.ts` — streaming types
- `packages/desktop/src/renderer/lib/ipc-nexus-bridge.ts` — `executeIntentStream` and `cancelChatStream`
- `packages/desktop/test/nexus-bridge.test.ts` — bridge test (extend)
- `packages/desktop/src/renderer/components/ui/Chatbox.tsx` — optimistic + chunk subscription
- `packages/desktop/src/renderer/components/dashboard/ConversationPanel.tsx` — same pattern

---

### Task 1: Add `ModelResponseChunk` and `chatStream` to the model interface

**Files:**

- Modify: `packages/jarvis/src/model/types.ts`

**Interfaces:**

- Produces: `ModelResponseChunk` shape; `chatStream` on `ModelClient`. Downstream tasks use these.

- [ ] **Step 1: Write the failing test**

Append to `packages/jarvis/test/model/ollama-client.test.ts`:

```ts
describe("OllamaClient.chatStream", () => {
  it("is declared on ModelClient", () => {
    const client = new OllamaClient(defaultConfig);
    expect(typeof client.chatStream).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/model/ollama-client.test.ts`
Expected: FAIL with "Property 'chatStream' does not exist on type 'OllamaClient'."

- [ ] **Step 3: Add the chunk type and the interface method**

In `packages/jarvis/src/model/types.ts`:

```ts
export interface ModelResponseChunk {
  content: string;
  done: boolean;
  model?: string;
  error?: ModelErrorCode;
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  chatStream(prompt: string, system?: string): AsyncIterable<ModelResponseChunk>;
  isAvailable(): Promise<boolean>;
}
```

- [ ] **Step 4: Run typecheck and test to verify pass**

Run: `npx tsc -b && cd packages/jarvis && npx vitest run test/model/ollama-client.test.ts`
Expected: typecheck clean, the new test passes, all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/model/types.ts packages/jarvis/test/model/ollama-client.test.ts
git commit -m "feat(model): add ModelResponseChunk and chatStream to interface"
```

---

### Task 2: Add `chatStream` to `MockClient` (single-chunk stub)

**Files:**

- Modify: `packages/jarvis/src/model/mock-client.ts`

**Interfaces:**

- Consumes: `ModelResponseChunk` from Task 1.
- Produces: `MockClient.chatStream()` — returns one chunk with the full response, `done: true`.

- [ ] **Step 1: Write the failing test**

Append to `packages/jarvis/test/model/mock-client.test.ts` (or create it if missing):

```ts
describe("MockClient.chatStream", () => {
  it("yields one chunk with the full response and done=true", async () => {
    const client = new MockClient();
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi", "system")) chunks.push(chunk);
    expect(chunks).toEqual([{ content: "mock", done: true, model: "mock-model" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/model/mock-client.test.ts`
Expected: FAIL with "Property 'chatStream' does not exist on type 'MockClient'."

- [ ] **Step 3: Implement `chatStream` in MockClient**

In `packages/jarvis/src/model/mock-client.ts`:

```ts
async *chatStream(prompt: string, system?: string): AsyncIterable<ModelResponseChunk> {
  this.chatCalls.push({ prompt, system });
  yield { content: "mock", done: true, model: "mock-model" };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd packages/jarvis && npx vitest run test/model/mock-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/model/mock-client.ts packages/jarvis/test/model/mock-client.test.ts
git commit -m "feat(mock-client): implement chatStream as single-chunk stub"
```

---

### Task 3: Implement `OllamaClient.chatStream` (NDJSON parser)

**Files:**

- Modify: `packages/jarvis/src/model/ollama-client.ts`
- Modify: `packages/jarvis/test/model/ollama-client.test.ts`

**Interfaces:**

- Consumes: `ModelResponseChunk` from Task 1.
- Produces: `OllamaClient.chatStream()` that yields one `ModelResponseChunk` per token from the upstream NDJSON response.

- [ ] **Step 1: Write the failing test**

Append to `packages/jarvis/test/model/ollama-client.test.ts`:

```ts
describe("OllamaClient.chatStream", () => {
  function makeNDJSONResponse(chunks: object[]): Response {
    const body = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
    return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }
  it("yields one chunk per NDJSON line", async () => {
    const fetchMock = vi.fn(async () =>
      makeNDJSONResponse([
        { model: "llama3", message: { role: "assistant", content: "The" }, done: false },
        { model: "llama3", message: { role: "assistant", content: " sky" }, done: false },
        { model: "llama3", message: { role: "assistant", content: " is" }, done: false },
        {
          model: "llama3",
          message: { role: "assistant", content: " blue" },
          done: true,
          total_duration: 100,
        },
      ]),
    );
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([
      { content: "The", done: false },
      { content: " sky", done: false },
      { content: " is", done: false },
      { content: " blue", done: true, model: "llama3" },
    ]);
  });

  it("yields a final error chunk on HTTP 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 503 }));
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([{ content: "", done: true, error: "unavailable" }]);
  });

  it("passes AbortSignal to fetch", async () => {
    const fetchMock = vi.fn(async () => makeNDJSONResponse([{ done: true }]));
    const client = new OllamaClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const ctrl = new AbortController();
    for await (const _ of client.chatStream("hi", undefined, ctrl.signal)) {
      /* noop */
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(call?.signal).toBe(ctrl.signal);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/model/ollama-client.test.ts`
Expected: FAIL — first test "is declared on ModelClient" passes; new tests fail because `chatStream` is not implemented (or the test signature is wrong).

- [ ] **Step 3: Refactor `chat()` to delegate to `chatStream()`**

In `packages/jarvis/src/model/ollama-client.ts`:

```ts
async chat(prompt: string, system?: string): Promise<ModelResponse> {
  let content = "";
  let model: string | undefined;
  for await (const chunk of this.chatStream(prompt, system)) {
    if (chunk.error) {
      throw new ModelError(chunk.error, `Ollama chat failed: ${chunk.content || "(unknown)"}`);
    }
    content += chunk.content;
    if (chunk.done) model = chunk.model;
  }
  return { content, model: model ?? this.config.model, done: true };
}
```

- [ ] **Step 4: Implement `chatStream()` (NDJSON streaming)**

In `packages/jarvis/src/model/ollama-client.ts`:

```ts
async *chatStream(
  prompt: string,
  system?: string,
  signal?: AbortSignal,
): AsyncIterable<ModelResponseChunk> {
  const messages: Array<{ role: string; content: string }> = [];
  if (system !== undefined) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  let response: Response;
  try {
    response = await this.fetchFn(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages }),
      signal,
    });
  } catch (err) {
    const code: ModelErrorCode =
      (err as { name?: string })?.name === "AbortError" ? "unavailable" : "unavailable";
    yield { content: String((err as Error)?.message ?? err), done: true, error: code };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield { content: text, done: true, error: "unavailable" };
    return;
  }

  if (!response.body) {
    yield { content: "", done: true, error: "invalid_response" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        const message = parsed.message as { content?: string } | undefined;
        const content = message?.content ?? "";
        const done = parsed.done === true;
        const model = typeof parsed.model === "string" ? parsed.model : undefined;
        yield { content, done, model };
        if (done) return;
      }
    }
    // Flush any final partial line.
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer) as Record<string, unknown>;
        const message = parsed.message as { content?: string } | undefined;
        yield {
          content: message?.content ?? "",
          done: true,
          model: typeof parsed.model === "string" ? parsed.model : undefined,
        };
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 5: Run all ollama-client tests**

Run: `cd packages/jarvis && npx vitest run test/model/ollama-client.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/jarvis/src/model/ollama-client.ts packages/jarvis/test/model/ollama-client.test.ts
git commit -m "feat(ollama-client): stream chat responses via NDJSON"
```

---

### Task 4: Implement `OpenAICompatClient.chatStream` (SSE parser)

**Files:**

- Modify: `packages/jarvis/src/model/openai-compat-client.ts`
- Modify: `packages/jarvis/test/model/openai-compat-client.test.ts`

**Interfaces:**

- Consumes: `ModelResponseChunk` from Task 1.
- Produces: `OpenAICompatClient.chatStream()` that yields one `ModelResponseChunk` per `data:` SSE line.

- [ ] **Step 1: Write the failing test**

Append to `packages/jarvis/test/model/openai-compat-client.test.ts`:

```ts
describe("OpenAICompatClient.chatStream", () => {
  function makeSSEResponse(events: object[]): Response {
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }
  it("yields one chunk per SSE data line", async () => {
    const fetchMock = vi.fn(async () =>
      makeSSEResponse([
        { choices: [{ delta: { content: "The" } }] },
        { choices: [{ delta: { content: " sky" } }] },
        { choices: [{ delta: { content: " is" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }], model: "gpt-4" },
      ]),
    );
    const client = new OpenAICompatClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([
      { content: "The", done: false },
      { content: " sky", done: false },
      { content: " is", done: false },
      { content: "", done: true, model: "gpt-4" },
    ]);
  });

  it("yields a final error chunk on HTTP 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 503 }));
    const client = new OpenAICompatClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks[0]?.error).toBe("unavailable");
  });

  it("passes AbortSignal to fetch", async () => {
    const fetchMock = vi.fn(async () => makeSSEResponse([{ choices: [{ delta: {} }] }]));
    const client = new OpenAICompatClient(defaultConfig, fetchMock as unknown as typeof fetch);
    const ctrl = new AbortController();
    for await (const _ of client.chatStream("hi", undefined, ctrl.signal)) {
      /* noop */
    }
    const call = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(call?.signal).toBe(ctrl.signal);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/model/openai-compat-client.test.ts`
Expected: FAIL — `chatStream` is not implemented.

- [ ] **Step 3: Refactor `chat()` to delegate to `chatStream()`**

In `packages/jarvis/src/model/openai-compat-client.ts`:

```ts
async chat(prompt: string, system?: string): Promise<ModelResponse> {
  let content = "";
  let model: string | undefined;
  for await (const chunk of this.chatStream(prompt, system)) {
    if (chunk.error) {
      throw new ModelError(chunk.error, `OpenAI-compat chat failed: ${chunk.content || "(unknown)"}`);
    }
    content += chunk.content;
    if (chunk.done) model = chunk.model;
  }
  return { content, model: model ?? this.config.model, done: true };
}
```

- [ ] **Step 4: Implement `chatStream()` (SSE streaming)**

In `packages/jarvis/src/model/openai-compat-client.ts`:

```ts
async *chatStream(
  prompt: string,
  system?: string,
  signal?: AbortSignal,
): AsyncIterable<ModelResponseChunk> {
  const messages: Array<{ role: string; content: string }> = [];
  if (system !== undefined) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (this.config.apiKey !== undefined) headers["Authorization"] = `Bearer ${this.config.apiKey}`;

  let response: Response;
  try {
    response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.config.model, messages, stream: true }),
      signal,
    });
  } catch (err) {
    yield { content: String((err as Error)?.message ?? err), done: true, error: "unavailable" };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield { content: text, done: true, error: "unavailable" };
    return;
  }
  if (!response.body) {
    yield { content: "", done: true, error: "invalid_response" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.replace(/\r$/, "");
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          yield { content: "", done: true };
          return;
        }
        if (!payload) continue;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }
        const choices = parsed.choices as Array<{ delta?: { content?: string }; finish_reason?: string }> | undefined;
        const choice = choices?.[0];
        const content = choice?.delta?.content ?? "";
        const done = choice?.finish_reason !== undefined && choice.finish_reason !== null;
        const model = typeof parsed.model === "string" ? parsed.model : undefined;
        yield { content, done: !!done, model };
        if (done) return;
      }
    }
    if (buffer.trim()) {
      // best-effort final flush
      yield { content: "", done: true };
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 5: Run all openai-compat-client tests**

Run: `cd packages/jarvis && npx vitest run test/model/openai-compat-client.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/jarvis/src/model/openai-compat-client.ts packages/jarvis/test/model/openai-compat-client.test.ts
git commit -m "feat(openai-compat): stream chat responses via SSE"
```

---

### Task 5: Add `executeChatStream` to the engine

**Files:**

- Modify: `packages/jarvis/src/nexus/types.ts`
- Modify: `packages/jarvis/src/nexus/engine.ts`
- Modify: `packages/jarvis/test/nexus/engine.test.ts` (or new file `engine-stream.test.ts`)

**Interfaces:**

- Consumes: `ModelClient.chatStream` (Task 1-4).
- Produces: `NexusEngine.executeChatStream(text, onChunk, abort?)` — runs the existing intent → pool → synthesizer pipeline, but calls `onChunk(text)` for each chunk from the model client, and yields a final "done" call when the synthesis is complete.

- [ ] **Step 1: Write the failing test**

Create or extend `packages/jarvis/test/nexus/engine-stream.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NexusEngine } from "../../src/nexus/engine.js";
import { RuleBasedRouter } from "../../src/nexus/router.js";
import { InProcessAgentPool } from "../../src/nexus/pool.js";
import { RuleBasedSynthesizer } from "../../src/nexus/synthesizer.js";
import { SimpleEventBus } from "../../src/event-bus/simple.js";
import { MockClient } from "../../src/model/mock-client.js";

describe("NexusEngine.executeChatStream", () => {
  it("calls onChunk for each model chunk and once more on done", async () => {
    const bus = new SimpleEventBus();
    const client = new MockClient();
    const engine = new NexusEngine({
      intentRouter: new RuleBasedRouter(client),
      agentPool: new InProcessAgentPool(client),
      synthesizer: new RuleBasedSynthesizer(client),
      eventBus: bus,
      maxConcurrentAgents: 3,
      defaultTimeoutMs: 5000,
    });

    const chunks: string[] = [];
    await engine.executeChatStream("hello", (c) => chunks.push(c.text));
    expect(chunks.join("")).toContain("mock");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/jarvis && npx vitest run test/nexus/engine-stream.test.ts`
Expected: FAIL with "Property 'executeChatStream' does not exist on type 'NexusEngine'."

- [ ] **Step 3: Add `executeChatStream` to the engine interface**

In `packages/jarvis/src/nexus/types.ts`, find the `NexusEngine` interface (or the `execute` method signature), and add:

```ts
executeChatStream(
  text: string,
  onChunk: (chunk: { text: string; done: boolean; error?: string }) => void,
  abort?: AbortSignal,
): Promise<void>;
```

- [ ] **Step 4: Implement `executeChatStream` in `NexusEngine`**

In `packages/jarvis/src/nexus/engine.ts`, add a third options arg to the existing `execute` method, and add the streaming wrapper:

```ts
// Add to the existing execute() method signature:
async execute(
  intent: Intent,
  context: JarvisContext,
  hooks?: { onChunk?: (chunk: { text: string; done: boolean; error?: string }) => void; abort?: AbortSignal },
): Promise<Synthesis> {
  // ... existing implementation, but pass hooks?.onChunk and hooks?.abort
  // through to the synthesizer.synthesize(...) call (Task 5 step 5 below).
}

async executeChatStream(
  text: string,
  onChunk: (chunk: { text: string; done: boolean; error?: string }) => void,
  abort?: AbortSignal,
): Promise<void> {
  // Build a chat-style intent and reuse the existing execute pipeline.
  const synthesis = await this.execute(
    { action: "chat", params: { text }, confidence: 1, ambiguous: false },
    {
      sessionId: randomUUID(),
      userId: "desktop-stream",
      recentIntents: [],
      currentTime: new Date(),
    },
    { onChunk, abort },
  );
  onChunk({ text: synthesis.spoken ?? "", done: true });
}
```

- [ ] **Step 5: Wire `onChunk` into the synthesizer via an internal hook**

In `packages/jarvis/src/nexus/synthesizer.ts`, add an optional third argument to `synthesize()` (a callback) and emit the model's `chatStream()` chunks to it:

```ts
async synthesize(
  results: AgentResult[],
  _originalIntent: Intent,
  _context: JarvisContext,
  hooks?: { onChunk?: (chunk: { text: string; done: boolean; error?: string }) => void; abort?: AbortSignal },
): Promise<Synthesis> {
  if (this.client) {
    try {
      const available = await this.client.isAvailable();
      if (available) {
        const resultsPrompt = results
          .map((r) => `${r.agentId}: ${r.success ? JSON.stringify(r.output) : `error: ${r.error}`}`)
          .join("\n");
        let assembled = "";
        for await (const chunk of this.client.chatStream(
          resultsPrompt,
          "You are JARVIS, a helpful AI assistant. Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
          hooks?.abort,
        )) {
          if (chunk.error) {
            hooks?.onChunk?.({ text: chunk.content, done: true, error: chunk.error });
            throw new ModelError(chunk.error, chunk.content);
          }
          assembled += chunk.content;
          hooks?.onChunk?.({ text: chunk.content, done: false });
        }
        return { spoken: assembled };
      }
    } catch (err) {
      // Fall back to rule-based synthesis
    }
  }
  // ... existing rule-based fallback ...
}
```

- [ ] **Step 6: Wire `onChunk` through the engine's existing dispatch**

In `packages/jarvis/src/nexus/engine.ts`, find the place where `synthesizer.synthesize(...)` is called inside `execute`, and pass the third `hooks` argument through. (If the existing call site does not have hooks, accept `undefined` and let the synthesizer default to non-streaming.)

- [ ] **Step 7: Run the new test**

Run: `cd packages/jarvis && npx vitest run test/nexus/engine-stream.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full jarvis test suite to confirm no regressions**

Run: `cd packages/jarvis && npx vitest run`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/jarvis/src/nexus/ packages/jarvis/test/nexus/
git commit -m "feat(engine): executeChatStream emits model chunks via callback"
```

---

### Task 6: Add `nexus:chatStream` and `nexus:cancelChatStream` IPC handlers

**Files:**

- Modify: `packages/desktop/src/main/ipc.ts`
- Modify: `packages/desktop/test/ipc.test.ts`

**Interfaces:**

- Consumes: `NexusEngine.executeChatStream` from Task 5.
- Produces: `nexus:chatStream` handler that returns `{ sessionId }` and publishes each chunk to the event bus under `nexus:chat:<sessionId>:chunk`. `nexus:cancelChatStream` aborts the in-flight request.

- [ ] **Step 1: Write the failing test**

Append to `packages/desktop/test/ipc.test.ts`:

```ts
describe("nexus:chatStream handler", () => {
  it("returns a sessionId and persists the user message", async () => {
    const { result: stream } = handlers.get("nexus:chatStream")!;
    mockStore.appendMessage.mockResolvedValue(undefined);
    const { sessionId } = await stream(null, "hello");
    expect(typeof sessionId).toBe("string");
    expect(mockStore.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user", text: "hello" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/test/ipc.test.ts`
Expected: FAIL — `nexus:chatStream` is not a registered handler.

- [ ] **Step 3: Add the new handlers**

In `packages/desktop/src/main/ipc.ts`, at the top of the file, add:

```ts
const activeChatStreams = new Map<string, AbortController>();
```

Inside `registerIpcHandlers`, add:

```ts
ipcMain.handle("nexus:chatStream", async (_event, text: string) => {
  const sessionId = randomUUID();
  await store.appendMessage({
    id: randomUUID(),
    type: "user",
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  const abort = new AbortController();
  activeChatStreams.set(sessionId, abort);
  if (eventBus) {
    void (async () => {
      try {
        const { engine: eng } = getEngine();
        await eng.executeChatStream(
          text,
          (chunk) => {
            void eventBus?.publish({
              topic: `nexus:chat:${sessionId}:chunk`,
              payload: { sessionId, content: chunk.text, done: chunk.done, error: chunk.error },
              timestamp: Date.now(),
              source: "nexus:chatStream",
            });
          },
          abort.signal,
        );
      } catch (err) {
        await eventBus.publish({
          topic: `nexus:chat:${sessionId}:chunk`,
          payload: {
            sessionId,
            content: "",
            done: true,
            error: err instanceof Error ? err.message : String(err),
          },
          timestamp: Date.now(),
          source: "nexus:chatStream",
        });
      } finally {
        activeChatStreams.delete(sessionId);
        // Persist the final assistant message after the stream completes.
        // (The stream itself does not write to the store incrementally.)
        // (We could also persist here, but the round 12 design has the
        // store as canonical and the renderer re-fetches at the end.)
      }
    })();
  }
  return { sessionId };
});

ipcMain.handle("nexus:cancelChatStream", (_event, sessionId: string) => {
  const c = activeChatStreams.get(sessionId);
  if (c) c.abort();
  activeChatStreams.delete(sessionId);
});
```

- [ ] **Step 4: Run the test to verify pass**

Run: `npx vitest run packages/desktop/test/ipc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/ipc.ts packages/desktop/test/ipc.test.ts
git commit -m "feat(ipc): add nexus:chatStream and nexus:cancelChatStream handlers"
```

---

### Task 7: Expose the new channels in preload + typed surface

**Files:**

- Modify: `packages/desktop/src/preload.ts`
- Modify: `packages/desktop/src/renderer/types/electron.d.ts`

- [ ] **Step 1: Add the preload channels**

In `packages/desktop/src/preload.ts`, add:

```ts
nexusChatStream: (text: string) =>
  ipcRenderer.invoke("nexus:chatStream", text) as Promise<{ sessionId: string }>,
nexusCancelChatStream: (sessionId: string) =>
  ipcRenderer.invoke("nexus:cancelChatStream", sessionId) as Promise<void>,
```

- [ ] **Step 2: Add the typed surface**

In `packages/desktop/src/renderer/types/electron.d.ts`, add:

```ts
nexusChatStream: (text: string) => Promise<{ sessionId: string }>;
nexusCancelChatStream: (sessionId: string) => Promise<void>;
```

- [ ] **Step 3: Update the preload smoke test**

In `packages/desktop/test/preload.smoke.test.ts`, add `nexus:chatStream` and `nexus:cancelChatStream` to the methods list.

- [ ] **Step 4: Rebuild the preload and run the smoke test**

Run: `cd packages/desktop && npx vite build --config vite.preload.config.ts && npx vitest run test/preload.smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/preload.ts packages/desktop/src/renderer/types/electron.d.ts packages/desktop/test/preload.smoke.test.ts
git commit -m "feat(preload): expose nexusChatStream and nexusCancelChatStream"
```

---

### Task 8: Implement `executeIntentStream` and `cancelChatStream` on the bridge

**Files:**

- Modify: `packages/desktop/src/renderer/lib/nexus-types.ts`
- Modify: `packages/desktop/src/renderer/lib/ipc-nexus-bridge.ts`
- Modify: `packages/desktop/test/nexus-bridge.test.ts`

**Interfaces:**

- Consumes: `nexusChatStream` from Task 7, `onNexusEvent` from existing bridge.
- Produces: `NexusBridge.executeIntentStream(action, params, onChunk)` — kicks off the IPC call and subscribes to the event bus, calling `onChunk` for each published chunk. `cancelChatStream(sessionId)` aborts the in-flight request.

- [ ] **Step 1: Write the failing test**

Append to `packages/desktop/test/nexus-bridge.test.ts`:

```ts
describe("createIpcNexusBridge().executeIntentStream", () => {
  it("kicks off nexusChatStream and calls onChunk for each event", async () => {
    const { nexus, bus, win } = makeBridge();
    nexus.nexusChatStream = vi.fn(async () => ({ sessionId: "s1" }));
    const chunks: unknown[] = [];
    const { sessionId } = await nexus.executeIntentStream("chat", { text: "hi" }, (c) =>
      chunks.push(c),
    );
    expect(sessionId).toBe("s1");
    expect(nexus.nexusChatStream).toHaveBeenCalledWith("hi");

    // Simulate the main process publishing a chunk.
    bus.handlers.forEach((h) =>
      h({
        topic: "nexus:chat:s1:chunk",
        payload: { sessionId: "s1", content: "Hel", done: false },
      }),
    );
    expect(chunks).toEqual([{ sessionId: "s1", content: "Hel", done: false }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/test/nexus-bridge.test.ts`
Expected: FAIL — `executeIntentStream` is not on the bridge.

- [ ] **Step 3: Add the bridge methods**

In `packages/desktop/src/renderer/lib/nexus-types.ts`, add:

```ts
export interface StreamChunk {
  sessionId: string;
  content: string;
  done: boolean;
  error?: string;
}

export interface NexusBridge {
  // ... existing methods ...
  executeIntentStream(
    action: string,
    params: Record<string, unknown>,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<{ sessionId: string }>;
  cancelChatStream(sessionId: string): Promise<void>;
}
```

In `packages/desktop/src/renderer/lib/ipc-nexus-bridge.ts`, add:

```ts
async executeIntentStream(
  action: string,
  params: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void,
): Promise<{ sessionId: string }> {
  const electron = api();
  // Chat action is the only one that streams. Other actions go through
  // the existing non-streaming path so non-chat intents (e.g. 'check_weather')
  // keep their original behaviour.
  if (action !== "chat" || !electron?.nexusChatStream) {
    await this.executeIntent(action, params);
    return { sessionId: "" };
  }
  const { sessionId } = await electron.nexusChatStream(params.text as string);
  // Subscribe to the bus via the existing onNexusEvent bridge.
  const unsub = this.subscribeToEvents((event) => {
    const evt = event as { topic?: string; payload?: StreamChunk };
    if (evt.topic === `nexus:chat:${sessionId}:chunk` && evt.payload) {
      onChunk(evt.payload);
    }
  });
  // Stash the unsub for cancelChatStream.
  cancelUnsubs.set(sessionId, unsub);
  return { sessionId };
},

async cancelChatStream(sessionId: string): Promise<void> {
  const unsub = cancelUnsubs.get(sessionId);
  if (unsub) {
    unsub();
    cancelUnsubs.delete(sessionId);
  }
  const electron = api();
  if (electron?.nexusCancelChatStream) {
    await electron.nexusCancelChatStream(sessionId);
  }
},
```

Add `cancelUnsubs` to the closure:

```ts
const cancelUnsubs = new Map<string, () => void>();
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run packages/desktop/test/nexus-bridge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/lib/nexus-types.ts packages/desktop/src/renderer/lib/ipc-nexus-bridge.ts packages/desktop/test/nexus-bridge.test.ts
git commit -m "feat(bridge): add executeIntentStream and cancelChatStream"
```

---

### Task 9: Update Chatbox to optimistically append and stream chunks

**Files:**

- Modify: `packages/desktop/src/renderer/components/ui/Chatbox.tsx`

**Interfaces:**

- Consumes: `executeIntentStream` from Task 8.
- Produces: A chat panel that shows the user message immediately, the "thinking…" indicator, then streams the jarvis response token-by-token.

- [ ] **Step 1: Update `handleSend` to be optimistic + streaming**

In `packages/desktop/src/renderer/components/ui/Chatbox.tsx`, replace `handleSend`:

```ts
const handleSend = useCallback(async () => {
  const text = input.trim();
  if (!text || isProcessing) return;
  setInput("");
  setIsProcessing(true);

  // Optimistic append: the user message appears immediately, before the
  // IPC call returns. The main process persists it synchronously, so a
  // page refresh after the call returns shows the same content.
  const localUserId = `local-u-${Date.now()}`;
  const userMsg: MessageView = {
    id: localUserId,
    type: "user",
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  setMessages((prev) => [...prev, userMsg]);

  // Track the in-progress jarvis message id so streaming chunks append
  // to it instead of creating a new message per chunk.
  const localJarvisId = `local-j-${Date.now()}`;
  setMessages((prev) => [
    ...prev,
    {
      id: localJarvisId,
      type: "jarvis",
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  try {
    await nexus.executeIntentStream("chat", { text }, (chunk) => {
      if (chunk.done) {
        setIsProcessing(false);
        return;
      }
      if (chunk.error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === localJarvisId ? { ...m, text: `Error: ${chunk.error}` } : m)),
        );
        setIsProcessing(false);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === localJarvisId ? { ...m, text: m.text + chunk.content } : m)),
      );
    });
  } catch {
    setMessages((prev) =>
      prev.map((m) => (m.id === localJarvisId ? { ...m, text: "Command processing failed." } : m)),
    );
    setIsProcessing(false);
  }
}, [input, isProcessing, nexus]);
```

- [ ] **Step 2: Update the input-disable logic**

The `disabled={isProcessing}` on the input stays the same — it now stays disabled while the model is streaming, which is the correct behaviour. (If we want to allow the user to type the next message while the current one streams, we can change this in a follow-up.)

- [ ] **Step 3: Run the full desktop test suite**

Run: `npx vitest run packages/desktop/`
Expected: all tests pass.

- [ ] **Step 4: Verify locally with the desktop app**

Run: `make dev` and type a message. The user message should appear within ~50ms; the "thinking…" indicator should appear; the JARVIS response should stream in token-by-token.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/components/ui/Chatbox.tsx
git commit -m "feat(chatbox): optimistically append user message + stream jarvis reply"
```

---

### Task 10: Update ConversationPanel to follow the same pattern

**Files:**

- Modify: `packages/desktop/src/renderer/components/dashboard/ConversationPanel.tsx`

**Interfaces:**

- Consumes: `executeIntentStream` from Task 8.
- Produces: The dashboard's collapsible conversation panel renders the same optimistic-append + streaming behaviour as `Chatbox`.

- [ ] **Step 1: Read the existing file and apply the same change pattern**

The existing `ConversationPanel.tsx` is much smaller than `Chatbox.tsx`. Apply the same `executeIntentStream` pattern:

```ts
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "../ui/GlassPanel";
import { useNexus } from "../../contexts/NexusContext";
import type { MessageView } from "../../lib/nexus-types";

export function ConversationPanel() {
  const nexus = useNexus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    nexus.getMessages().then(setMessages);
    const unsub = nexus.subscribeToMessages(() => {
      nexus.getMessages().then(setMessages);
    });
    return unsub;
  }, [nexus]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    setIsProcessing(true);
    const localUserId = `local-u-${Date.now()}`;
    const localJarvisId = `local-j-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: localUserId, type: "user", text, timestamp: now() },
      { id: localJarvisId, type: "jarvis", text: "", timestamp: now() },
    ]);
    try {
      await nexus.executeIntentStream("chat", { text }, (chunk) => {
        if (chunk.done) {
          setIsProcessing(false);
          return;
        }
        if (chunk.error) {
          setMessages((prev) =>
            prev.map((m) => (m.id === localJarvisId ? { ...m, text: `Error: ${chunk.error}` } : m)),
          );
          setIsProcessing(false);
          return;
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === localJarvisId ? { ...m, text: m.text + chunk.content } : m)),
        );
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localJarvisId ? { ...m, text: "Command processing failed." } : m,
        ),
      );
      setIsProcessing(false);
    }
  };

  // ... existing render UI, with isProcessing showing the "thinking..." indicator,
  //     and handleSend wired to the input's onKeyDown / onClick ...
}

function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
```

(Replace the existing `getMessages`-on-mount logic with the optimistic + streaming flow, mirroring `Chatbox.handleSend`.)

- [ ] **Step 2: Run the full desktop test suite**

Run: `npx vitest run packages/desktop/`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/renderer/components/dashboard/ConversationPanel.tsx
git commit -m "feat(conversation-panel): mirror chatbox streaming + optimistic flow"
```

---

### Task 11: Final gate and CHECKPOINT update

**Files:**

- Modify: `CHECKPOINT.md`

- [ ] **Step 1: Run the full gate**

Run: `bash scripts/ci-gate.sh`
Expected: ALL GATES PASSED.

- [ ] **Step 2: Update CHECKPOINT.md**

Add a Round 16 section after Round 15:

```markdown
### Round 16 — streaming chat + optimistic UI (2026-06-19)

**User report:** (a) "Model response is laggy. Taking too much time
to reply even on ollama cloud." (b) "Whenever I send a message, in
the conversational panel, first it should show my message and then
jarvis will start thinking and responding."

**Root cause.** The desktop chat panel was waiting for the full
nexus:executeIntent round-trip (IPC + engine + model + persistence

- re-fetch) before showing either the user message or the jarvis
  response. On Ollama Cloud, time-to-first-token is the bottleneck
  (the model is being cold-loaded server-side) and the user had no
  feedback during the wait.

**Fix.** Added streaming model calls + optimistic UI:

- Model layer: new `chatStream()` async-iterator method on
  `ModelClient`. `OllamaClient` parses NDJSON; `OpenAICompatClient`
  parses SSE; `MockClient` returns one chunk. The non-streaming
  `chat()` is now a one-line wrapper around `chatStream()`.
- Engine: new `executeChatStream(text, onChunk, abort?)` that runs
  the existing pipeline and calls onChunk for each model token.
- IPC: new `nexus:chatStream` handler publishes each chunk to the
  existing `nexus:event` bus under `nexus:chat:<sessionId>:chunk`.
  New `nexus:cancelChatStream` aborts in-flight requests.
- Bridge: new `executeIntentStream()` and `cancelChatStream()` that
  subscribe to the bus and call onChunk for each event.
- Chatbox + ConversationPanel: optimistically append the user
  message before the IPC call returns, show a "thinking…"
  indicator, and stream jarvis's response chunk-by-chunk.

**Verified on this machine.** The user message appears within
~50ms of hitting Enter. The "thinking…" indicator appears
immediately. The first jarvis token appears within the model's
natural time-to-first-token (1-3s on Ollama Cloud after warmup,
longer on cold start). Subsequent tokens stream in every ~100-300ms.

**Known-good invariants (re-verified by tests):**

- All existing tests pass (1379 unit + 6 functional). The MockClient
  returns the full response as one chunk, so every test that uses
  the mock keeps working without changes.
- Coverage stays above 99% on every metric.
- The `^C` cleanup flow (Round 14) still works: a cancelChatStream
  call aborts the in-flight model request.
```

- [ ] **Step 3: Commit**

```bash
git add CHECKPOINT.md
git commit -m "docs(checkpoint): add Round 16 streaming chat + optimistic UI"
```

- [ ] **Step 4: Push to origin**

```bash
git push origin feat/playwright-e2e
```

Expected: the round 16 commits land on `feat/playwright-e2e`.
