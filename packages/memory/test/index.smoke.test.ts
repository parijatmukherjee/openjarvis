import { describe, it, expect } from "vitest";
import * as memory from "../src/index.js";

describe("@openjarvis/memory public surface", () => {
  it("re-exports the memory building blocks", () => {
    for (const name of [
      "JarvisMemoryStore",
      "VecnaStore",
      "MEMORY_SCHEMA",
      "rankCandidates",
      "toMatchQuery",
    ] as const) {
      expect(memory, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});
