# Streaming Chat Design

## Problem

Two related UX bugs in the desktop chat panel:

1. **Slow time-to-first-token.** When the user types a message and hits Enter, the chat panel stays blank for many seconds (5-30s on Ollama Cloud) before the user message and the JARVIS response appear together. The first chunk of the model output is what we are waiting for; the rest of the response is fast once it starts streaming.

2. **Message ordering.** The user message does not appear until the whole round-trip completes (IPC, engine, model, persistence, re-fetch). The user should see their own message the instant they send it, and a "thinking…" indicator until the first token arrives.

Both are caused by `nexus:executeIntent` (in `packages/desktop/src/main/ipc.ts`) being a request/response call that returns only when the full synthesis is done. The renderer (`packages/desktop/src/renderer/components/ui/Chatbox.tsx`) `await`s it before re-fetching and re-rendering messages.

## Decision

Stream the model response token-by-token from the main process to the renderer, and optimistically append the user message to the local UI before the IPC call returns. Both Ollama's native API and OpenAI-compat (Ollama Cloud included) already stream with the same wire format the renderer needs, so the change is local to four files.

## Scope

In scope:

- New `chatStream()` method on the `ModelClient` interface, implemented on `OllamaClient` and `OpenAICompatClient`. `MockClient` returns the full response as a single chunk. `OllamaClient.chatStream` omits `stream: false` from the request body so the upstream streams by default; `OpenAICompatClient.chatStream` sets `stream: true`.
- New `executeChatStream()` method on `NexusEngine` (in `packages/jarvis/src/nexus/engine.ts`). It runs the existing dispatch + synthesis pipeline but exposes a `onChunk(text)` callback that the main process wires to the event bus. The engine tracks an `activeSessionId` and `activeAbortController` so a second `executeChatStream` cancels the first.
- New `nexus:chatStream` IPC handler in `packages/desktop/src/main/ipc.ts` that kicks off a streaming chat, persists the user message synchronously, and emits chunks to the existing `nexus:event` bus.
- Streaming `executeIntentStream()` on `packages/desktop/src/renderer/lib/ipc-nexus-bridge.ts` that returns a session id and lets the renderer subscribe to chunks via the existing `onNexusEvent` channel.
- `Chatbox` and `ConversationPanel` optimistic-append the user message, show a "thinking…" indicator, and incrementally append model deltas as they arrive.
- Tests for the streaming model clients (using a fake `fetch` that returns NDJSON), the IPC handler (using a fake `NexusEngine`), the bridge, and the `Chatbox` component (TDD).

Out of scope (intentionally not in this round):

- Token-level persistence (we still only persist the final assembled response, not every chunk).
- Multi-turn conversation memory (the engine is still single-shot per intent).
- Tool/function calling from the streaming response.
- Aborting a stream via `^C` while the user is mid-response (the existing `^C` cleanup kills the whole process tree, which already works; we just make sure no orphan model request survives a renderer reload).
- Changing the model client **request** shape (the wire format is unchanged; only the response handling changes).
- Changing the model client `chat()` non-streaming path — it becomes a thin wrapper that calls `chatStream()` and accumulates, so the existing test surface stays intact.

## Architecture

```
User types
  |
  v
Chatbox.handleSend()
  | 1. setInput("")
  | 2. setMessages((prev) => [...prev, userMessage])     <-- optimistic
  | 3. setIsProcessing(true)
  | 4. electronAPI.nexusChatStream(text) -> { sessionId }
  |
  v
Main process
  | 5. store.appendMessage(userMessage)                   <-- persisted
  | 6. kick off NexusEngine.executeChatStream(sessionId, prompt, onChunk)
  |    - onChunk: synthesiser reads from ModelClient.chatStream
  |                and publishes each delta to bus topic
  |                "nexus:chat:<sessionId>:chunk"
  |
  v
Event bus
  | 7. event bus fires for each chunk
  |
  v
IPC bridge
  | 8. nexus:subscribeToEvents handler (already exists) calls
  |    win.webContents.send("nexus:event", { topic, payload })
  |
  v
Renderer bridge
  | 9. onNexusEvent callback (already exists) receives the event
  |    bridge.executeIntentStream handler appends the delta to the
  |    in-progress message for that sessionId
  |
  v
React
  | 10. setMessages((prev) => prev with appended delta)    <-- streamed
  | 11. on final chunk: getMessages() to refresh canonical ids
  | 12. setIsProcessing(false)
```

The bus is the same `SimpleEventBus` that already plumbs agent lifecycle
events to the renderer. We just add a new topic namespace
(`nexus:chat:<id>:chunk`) on top of it. No new IPC plumbing for tokens.

## Data model

```ts
// packages/jarvis/src/model/types.ts
export interface ModelResponseChunk {
  content: string; // incremental text for this chunk
  done: boolean; // true on the final chunk
  model?: string; // present on the final chunk
  error?: ModelErrorCode; // present if the stream errored
}

export interface ModelClient {
  chat(prompt: string, system?: string): Promise<ModelResponse>;
  chatStream(prompt: string, system?: string): AsyncIterable<ModelResponseChunk>;
  isAvailable(): Promise<boolean>;
}
```

```ts
// packages/desktop/src/main/ipc.ts (new handler)
ipcMain.handle("nexus:chatStream", async (_event, text: string) => {
  const sessionId = randomUUID();
  await store.appendMessage({ id: randomUUID(), type: "user", text, timestamp: now() });
  // Fire and forget; the renderer already subscribes via nexus:subscribeToEvents.
  // The engine's executeChatStream publishes each chunk to the event bus
  // under the topic "nexus:chat:<sessionId>:chunk".
  const abort = new AbortController();
  activeStreams.set(sessionId, abort);
  void runChatStream(sessionId, text, currentModelClient, abort.signal)
    .catch((err) => {
      // Publish a final error chunk so the renderer can clear its
      // isProcessing state.
      void eventBus?.publish({
        topic: `nexus:chat:${sessionId}:chunk`,
        payload: { sessionId, content: "", done: true, error: String(err) },
        timestamp: Date.now(),
        source: "nexus:chatStream",
      });
    })
    .finally(() => activeStreams.delete(sessionId));
  return { sessionId };
});
```

```ts
// packages/desktop/src/main/ipc.ts (cancellation)
ipcMain.handle("nexus:cancelChatStream", (_event, sessionId: string) => {
  const abort = activeStreams.get(sessionId);
  if (abort) abort.abort();
  activeStreams.delete(sessionId);
});
```

```ts
// packages/desktop/src/renderer/lib/nexus-types.ts (extended bridge)
export interface NexusBridge {
  // ... existing methods ...
  executeIntentStream(
    action: string,
    params: Record<string, unknown>,
    onChunk: (chunk: { sessionId: string; content: string; done: boolean; error?: string }) => void,
  ): Promise<{ sessionId: string }>;
  cancelChatStream(sessionId: string): Promise<void>;
}
```

## Failure modes

- **Ollama 5xx mid-stream.** `chatStream()` yields a final chunk with `error: "unavailable"`. The renderer appends a system message ("The model is currently unavailable") and clears `isProcessing`.
- **Renderer reload mid-stream.** The IPC handler uses an `AbortController` to cancel the in-flight HTTP request when the renderer's `cancelChatStream` is called or the WebContents is destroyed. The persisted user message stays; the partial assistant message is dropped (we never wrote it). On reload, the user sees their own message; no orphan token-burst.
- **Two concurrent chats.** The engine keeps a single `activeSessionId` map; a second `nexus:chatStream` cancels the first and publishes a final chunk with `done: true` and `error: "cancelled"`. The renderer's bridge raises a system message.
- **Model client not available.** The rule-based synthesizer produces a single `done: true` chunk with the synthesized text. The renderer sees the chunk and renders it. No observable difference from the pre-streaming behaviour.
- **Mock client (tests).** Returns the full response as a single chunk with `done: true`. Existing `MockClient` tests keep passing.

## What stays the same

- `nexus:getMessages` and `nexus:clearMessages` IPC channels.
- `DesktopStore.appendMessage` / `loadMessages` / `clearMessages` (we still persist the user message synchronously and the assistant message once at the end of the stream).
- `nexus:executeIntent` (older non-streaming entry point). `chat()` is the non-streaming wrapper; `executeIntent` callers keep working.
- The event bus. We use the existing `SimpleEventBus` with a new topic namespace.
- `nexus:subscribeToEvents` / `onNexusEvent` plumbing. We add a new event _type_ but the channel is unchanged.
- The `^C` cleanup flow. The `nexus:chatStream` handler registers a cleanup hook that aborts the active model request when the renderer disconnects.
- All existing test files. The `MockClient.chatStream` returns the full response as one chunk, which means `MockClient.chat()` (the non-streaming version) keeps working unchanged. The non-streaming `RuleBasedSynthesizer.synthesize()` is unchanged.

## Out-of-band: dotenv for `OLLAMA_API_KEY`

This design touches several files; it does not touch the model **client request** shape. The `OLLAMA_API_KEY` (and any other env-var read paths) stay as-is. We are not adding a new dependency on `dotenv`; this round has no env-var changes.

## Testing strategy

TDD, per the project's `AGENT.md` rule:

1. `packages/jarvis/test/model/ollama-client.test.ts` — new test for `OllamaClient.chatStream`. Use a fake `fetch` that returns an NDJSON response body with two chunks and a final `done: true` chunk. Assert the async iterator yields the right `ModelResponseChunk[]`.
2. `packages/jarvis/test/model/openai-compat-client.test.ts` — new test for `OpenAICompatClient.chatStream`. Use a fake `fetch` that returns SSE-formatted chunks.
3. `packages/desktop/test/ipc.test.ts` — new test for `nexus:chatStream` handler. Stub the engine's `executeChatStream` to push three chunks via a mock event bus; assert the handler returns the session id and the bus topic is `nexus:chat:<id>:chunk`.
4. `packages/desktop/test/nexus-bridge.test.ts` — new test for `createNexusBridge().executeIntentStream`. Stub `nexusChatStream` and the event-bus subscription; assert the bridge calls `onChunk` for each event.
5. `packages/desktop/src/renderer/components/ui/Chatbox.tsx` — no direct component test (we don't have a component-test runner set up for this). The behaviour is covered by the bridge test.

Coverage target: 99% statements / 99% lines / 100% functions / 99% branches
(unchanged from current gate).

## How to verify

1. `make dev` on a workstation (any OS).
2. Open the chat panel.
3. Type a long prompt that requires the model to think ("Explain the
   difference between TCP and UDP in 3 paragraphs, with examples").
4. Hit Enter.
5. Verify the user message appears within ~50ms.
6. Verify the "thinking…" indicator appears within ~50ms.
7. Verify the first word of the JARVIS response appears within the
   model's natural time-to-first-token (typically 1-3s on Ollama Cloud
   after warmup, longer on cold start).
8. Verify each subsequent word appears within ~100-300ms of the previous.
9. Repeat step 3 with `^C` mid-response. The process tree should be
   empty within 1s (the `Round 14` cleanup trap still works).
10. Run `npm run coverage` and verify all metrics stay above 99%.

## Why this design

- **Both providers already stream natively** — Ollama's `stream: true`
  default and OpenAI-compat's `text/event-stream` are standard. We do
  not need a custom protocol or a long-poll.
- **The existing event bus already plumbs main → renderer** — adding a
  new event topic is two lines of code; we do not need a new IPC
  channel for tokens.
- **One source of truth for the user message** — the main process
  writes it to `messages.json` synchronously, so the optimistic render
  in the UI matches what is persisted after a reload.
- **The assistant message is not streamed to disk** — only the final
  text. This avoids O(n) writes for a long response and keeps the test
  surface small.
- **The `chat()` non-streaming API is a one-line wrapper around
  `chatStream()`** — no duplicated wire logic, no API drift. Existing
  callers of `chat()` keep working.
- **`MockClient` and rule-based synthesis degrade gracefully** —
  `MockClient.chatStream()` returns one chunk with `done: true`; the
  rule-based synthesizer emits one chunk. The renderer's streaming
  code path is the only path, and it is exercised in tests and in
  production.
