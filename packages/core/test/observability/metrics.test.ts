import { describe, it, expect } from "vitest";
import { noopMetricsCollector, type MetricsCollector } from "../../src/observability/metrics.js";

describe("NoopMetricsCollector", () => {
  it("does nothing when incrementing a counter", () => {
    const m: MetricsCollector = noopMetricsCollector;
    expect(() => m.increment("TurnStarted", 1)).not.toThrow();
  });

  it("does nothing when recording a histogram", () => {
    const m: MetricsCollector = noopMetricsCollector;
    expect(() => m.histogram("ToolCallLatency", 42)).not.toThrow();
  });
});
