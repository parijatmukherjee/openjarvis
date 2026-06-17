import { describe, it, expect } from "vitest";
import { initPreload } from "../src/preload.js";

describe("preload smoke", () => {
  it("exports initPreload", () => {
    expect(typeof initPreload).toBe("function");
  });

  it("preload module can be imported without electron runtime", () => {
    // The module only declares a function; contextBridge is invoked at runtime.
    expect(initPreload).toBeDefined();
  });
});
