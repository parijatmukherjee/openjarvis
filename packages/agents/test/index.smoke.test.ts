import { describe, it, expect } from "vitest";
import * as oh from "../src/index.js";

describe("@openjarvis/agents public surface", () => {
  it("exports the agent factory placeholder", () => {
    expect(oh).toHaveProperty("createAgent");
    expect(typeof oh.createAgent).toBe("function");
  });
});
