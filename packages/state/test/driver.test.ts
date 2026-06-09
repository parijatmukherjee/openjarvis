import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/driver/driver.js";

describe("openDatabase pragmas", () => {
  it("enables a busy_timeout on the opened database", () => {
    const db = openDatabase({ path: ":memory:" });
    const timeout = db.prepare("PRAGMA busy_timeout").get() as { timeout: number };
    expect(timeout.timeout).toBeGreaterThanOrEqual(5000);
    db.close();
  });
});
