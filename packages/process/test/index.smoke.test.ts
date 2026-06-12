import { describe, it, expect } from "vitest";
import * as processExports from "../src/index.js";

describe("process package exports", () => {
  it("exports all public APIs", () => {
    expect(processExports.AGENT_LOOP_PHASES).toBeDefined();
    expect(processExports.ProcessEngine).toBeDefined();
    expect(processExports.ProcessError).toBeDefined();
    expect(processExports.HookRegistry).toBeDefined();
    expect(processExports.ProcessEventBus).toBeDefined();
    expect(processExports.runCli).toBeDefined();
  });
});
