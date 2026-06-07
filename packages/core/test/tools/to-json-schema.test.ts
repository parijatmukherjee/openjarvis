import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toJsonSchema } from "../../src/tools/to-json-schema.js";

describe("toJsonSchema", () => {
  it("converts a zod object into a JSON Schema object with properties", () => {
    const schema = z.object({ path: z.string(), depth: z.number().int() });
    const json = toJsonSchema(schema);
    expect(json.type).toBe("object");
    const props = json.properties as Record<string, unknown>;
    // Compare as a set — JSON Schema property order is not semantically meaningful
    // and can vary across zod-to-json-schema versions.
    expect(Object.keys(props).sort()).toEqual(["depth", "path"]);
    expect((props.path as Record<string, unknown>).type).toBe("string");
  });

  it("marks required fields", () => {
    const json = toJsonSchema(z.object({ a: z.string() }));
    expect(json.required).toEqual(["a"]);
  });
});
