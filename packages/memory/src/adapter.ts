import type { MemoryStore } from "@openjarvis/core";
import type { JarvisMemoryStore } from "./store.js";

export function asMemoryStore(store: JarvisMemoryStore): MemoryStore {
  return {
    async recall(query: string, k?: number): Promise<string[]> {
      const args: { text: string; now: number; k?: number } = { text: query, now: Date.now() };
      if (k !== undefined) {
        args.k = k;
      }
      const results = await store.recall(args);
      return results.map((r) => r.text);
    },
  };
}
