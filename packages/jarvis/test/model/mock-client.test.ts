import { describe, it, expect } from "vitest";
import { MockModelClient } from "../../src/model/mock-client.js";
import { ModelError } from "../../src/model/error.js";
import type { ModelResponseChunk } from "../../src/model/types.js";

describe("MockModelClient.chatStream", () => {
  it("yields one chunk with the full configured response and done=true", async () => {
    const client = new MockModelClient({
      response: { content: "hello world", model: "mock-model", done: true },
    });
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi", "system")) chunks.push(chunk);
    expect(chunks).toEqual([{ content: "hello world", done: true, model: "mock-model" }]);
  });

  it("records the call on chatCalls", async () => {
    const client = new MockModelClient();
    for await (const _chunk of client.chatStream("hi", "system")) {
      /* consume */
    }
    expect(client.chatCalls).toEqual([{ prompt: "hi", system: "system" }]);
  });

  it("records calls without a system prompt", async () => {
    const client = new MockModelClient();
    for await (const _chunk of client.chatStream("hi")) {
      /* consume */
    }
    expect(client.chatCalls).toEqual([{ prompt: "hi" }]);
  });

  it("yields a single chunk with the default mock response when no config is provided", async () => {
    const client = new MockModelClient();
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([{ content: "mock response", done: true, model: "mock" }]);
  });

  it("yields a final error chunk when a ModelError is configured", async () => {
    const client = new MockModelClient({
      error: new ModelError("unavailable", "service down"),
    });
    const chunks: ModelResponseChunk[] = [];
    for await (const chunk of client.chatStream("hi")) chunks.push(chunk);
    expect(chunks).toEqual([
      { content: "service down", done: true, model: "mock", error: "unavailable" },
    ]);
  });

  it("still records the call when an error is configured", async () => {
    const client = new MockModelClient({
      error: new ModelError("unavailable", "service down"),
    });
    for await (const _chunk of client.chatStream("hi", "system")) {
      /* consume */
    }
    expect(client.chatCalls).toEqual([{ prompt: "hi", system: "system" }]);
  });
});
