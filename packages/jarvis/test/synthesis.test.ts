import { describe, it, expectTypeOf } from "vitest";
import type { VisualCommand } from "../src/index.js";

describe("VisualCommand old types", () => {
  it("open_app compiles", () => {
    const cmd: VisualCommand = { type: "open_app", app: "browser" };
    expectTypeOf(cmd).toBeObject();
  });

  it("open_url compiles", () => {
    const cmd: VisualCommand = { type: "open_url", url: "https://example.com" };
    expectTypeOf(cmd).toBeObject();
  });

  it("show_text compiles", () => {
    const cmd: VisualCommand = { type: "show_text", text: "hello" };
    expectTypeOf(cmd).toBeObject();
  });

  it("highlight compiles", () => {
    const cmd: VisualCommand = { type: "highlight", element: "#btn" };
    expectTypeOf(cmd).toBeObject();
  });

  it("clear compiles", () => {
    const cmd: VisualCommand = { type: "clear" };
    expectTypeOf(cmd).toBeObject();
  });
});

describe("VisualCommand new types", () => {
  it("open_vision_feed compiles", () => {
    const cmd: VisualCommand = { type: "open_vision_feed" };
    expectTypeOf(cmd).toBeObject();
  });

  it("show_agent_output compiles", () => {
    const cmd: VisualCommand = { type: "show_agent_output", agentId: "agent-1" };
    expectTypeOf(cmd).toBeObject();
  });

  it("show_context_card compiles", () => {
    const cmd: VisualCommand = { type: "show_context_card", title: "Info", body: "Details" };
    expectTypeOf(cmd).toBeObject();
  });
});
