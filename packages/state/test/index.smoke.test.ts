import { describe, it, expect } from "vitest";
import * as state from "../src/index.js";

describe("@openhawkins/state public surface", () => {
  it("re-exports the persistence building blocks", () => {
    for (const name of ["openDatabase", "migrate", "SCHEMA", "SqliteEventStore"] as const) {
      expect(state, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});
