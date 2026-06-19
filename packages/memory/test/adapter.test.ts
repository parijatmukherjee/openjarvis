import { describe, it, expect, vi } from "vitest";
import { asMemoryStore } from "../src/adapter.js";

describe("asMemoryStore", () => {
  it("calls store.recall without k when k is not provided", async () => {
    const recall = vi.fn().mockResolvedValue([
      { text: "result a", score: 0.9 },
      { text: "result b", score: 0.5 },
    ]);
    const store = { recall } as unknown as import("../src/store.js").JarvisMemoryStore;
    const mem = asMemoryStore(store);
    const results = await mem.recall("query");

    expect(recall).toHaveBeenCalledOnce();
    expect(recall.mock.calls[0][0]).toMatchObject({ text: "query" });
    expect(recall.mock.calls[0][0]).not.toHaveProperty("k");
    expect(results).toEqual(["result a", "result b"]);
  });

  it("calls store.recall with k when k is provided", async () => {
    const recall = vi.fn().mockResolvedValue([
      { text: "result a", score: 0.9 },
      { text: "result b", score: 0.5 },
    ]);
    const store = { recall } as unknown as import("../src/store.js").JarvisMemoryStore;
    const mem = asMemoryStore(store);
    const results = await mem.recall("query", 5);

    expect(recall).toHaveBeenCalledOnce();
    expect(recall.mock.calls[0][0]).toMatchObject({ text: "query", k: 5 });
    expect(results).toEqual(["result a", "result b"]);
  });
});
