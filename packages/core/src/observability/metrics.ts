export interface MetricsCollector {
  increment(name: string, value?: number): void;
  histogram(name: string, value: number): void;
}

export const noopMetricsCollector: MetricsCollector = {
  increment() {},
  histogram() {},
};
