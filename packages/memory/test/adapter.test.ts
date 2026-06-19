import { describe, it, expect, vi } from "vitest";
import { asMemoryStore } from "../src/adapter.js";

function mockStore() {
  return {
    recall: vi.fn().mockResolvedValue([
      { text: "result a", score: 0.9 },
      { text: "result b", score: 0.5 },
    ]),
  };
}

describe("asMemoryStore", () => {
  it("calls store.recall without k when k is not provided", async () => {
    const store = mockStore();
    const mem = asMemoryStore(store as any);
    const results = await mem.recall("query");

    expect(store.recall).toHaveBeenCalledOnce();
    const args = store.recall.mock.calls[0][0];
    expect(args).toMatchObject({ text: "query" });
    expect(args).not.toHaveProperty("k");
    expect(results).toEqual(["result a", "result b"]);
  });

  it("calls store.recall with k when k is provided", async () => {
    const store = mockStore();
    const mem = asMemoryStore(store as any);
    const results = await mem.recall("query", 5);

    expect(store.recall).toHaveBeenCalledOnce();
    const args = store.recall.mock.calls[0][0];
    expect(args).toMatchObject({ text: "query", k: 5 });
    expect(results).toEqual(["result a", "result b"]);
  });
});
