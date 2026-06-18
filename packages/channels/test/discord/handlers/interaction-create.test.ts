import { describe, it, expect } from "vitest";
import { mapInteractionCreate } from "../../../src/discord/handlers/interaction-create.js";

describe("mapInteractionCreate", () => {
  it("maps a valid INTERACTION_CREATE payload with data", () => {
    const payload = {
      id: "int1",
      type: 2,
      data: { name: "ping", options: [{ name: "arg", value: "val" }] },
    };

    const result = mapInteractionCreate(payload);
    expect(result).toEqual({
      id: "int1",
      type: 2,
      name: "ping",
      data: { name: "ping", options: [{ name: "arg", value: "val" }] },
    });
  });

  it("maps without data field", () => {
    const payload = {
      id: "int2",
      type: 1,
    };

    const result = mapInteractionCreate(payload);
    expect(result).toEqual({
      id: "int2",
      type: 1,
      name: "",
    });
  });

  it("maps with empty data", () => {
    const payload = {
      id: "int3",
      type: 2,
      data: {},
    };

    const result = mapInteractionCreate(payload);
    expect(result.name).toBe("");
  });

  it("throws on missing id", () => {
    expect(() => mapInteractionCreate({ type: 1 })).toThrow("Missing id");
  });

  it("throws on missing type", () => {
    expect(() => mapInteractionCreate({ id: "i1" })).toThrow("Missing type");
  });

  it("throws on non-object payload", () => {
    expect(() => mapInteractionCreate("bad")).toThrow("Invalid INTERACTION_CREATE payload");
    expect(() => mapInteractionCreate(null)).toThrow("Invalid INTERACTION_CREATE payload");
  });
});