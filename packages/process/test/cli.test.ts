import { describe, it, expect } from "vitest";
import { runCli } from "../src/cli.js";

describe("CLI", () => {
  it("parses --phase and --plan args without throwing", async () => {
    await expect(runCli(["--phase=research", "--plan=docs/plans/test.md"])).rejects.toThrow(
      "No handler for phase research",
    );
  });

  it("parses --phase without --plan", async () => {
    await expect(runCli(["--phase=research"])).rejects.toThrow("No handler");
  });

  it("parses --plan without --phase", async () => {
    // Will fail on first phase with no handler because no phase specified
    await expect(runCli(["--plan=docs/plans/test.md"])).rejects.toThrow("No handler");
  });

  it("runs without args", async () => {
    await expect(runCli([])).rejects.toThrow("No handler");
  });
});
