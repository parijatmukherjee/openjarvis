import { describe, it, expectTypeOf } from "vitest";
import type {
  VisualResolver,
  VisualResolverConfig,
  Intent,
  JarvisContext,
  AgentResult,
  VisualCommand,
} from "../src/index.js";

describe("VisualResolver interface", () => {
  it("is an object type with resolve method", () => {
    expectTypeOf<VisualResolver>().toBeObject();
    expectTypeOf<VisualResolver["resolve"]>().toBeFunction();
  });

  it("resolve accepts correct parameters and returns VisualCommand[]", () => {
    expectTypeOf<VisualResolver["resolve"]>()
      .parameters.toEqualTypeOf<[Intent, AgentResult[], JarvisContext]>();
    expectTypeOf<VisualResolver["resolve"]>().returns.toEqualTypeOf<VisualCommand[]>();
  });
});

describe("VisualResolverConfig interface", () => {
  it("has correct structure", () => {
    expectTypeOf<VisualResolverConfig>().toBeObject();
    expectTypeOf<VisualResolverConfig["mappings"]>().toEqualTypeOf<Record<string, VisualCommand>>();
    expectTypeOf<VisualResolverConfig["defaultMonitor"]>().toBeNumber();
    expectTypeOf<VisualResolverConfig["enabled"]>().toBeBoolean();
  });
});
