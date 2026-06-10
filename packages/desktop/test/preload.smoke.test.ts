import { describe, it, expect } from "vitest";
import { initPreload } from "../src/preload.js";

describe("preload smoke", () => {
  it("exports initPreload", () => {
    expect(typeof initPreload).toBe("function");
  });
});
