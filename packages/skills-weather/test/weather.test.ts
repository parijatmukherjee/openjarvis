import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createWeatherCurrentTool,
  createWeatherForecastTool,
  registerWeatherTools,
} from "../src/weather.js";

const ctx = { agentId: "test-agent" };
const weatherGrant: AgentGrant = {
  agentId: "test-agent",
  capabilities: [{ name: "weather:read" }],
};

function mockWttrResponse(overrides: Record<string, unknown> = {}) {
  const base = {
    current_condition: [
      {
        temp_C: "22",
        FeelsLikeC: "20",
        humidity: "65",
        weatherDesc: [{ value: "Partly cloudy" }],
        winddir16Point: "SW",
        windspeedKmph: "15",
        visibility: "10",
        pressure: "1013",
      },
    ],
    weather: [
      {
        date: "2026-06-18",
        maxtempC: "25",
        mintempC: "18",
        hourly: [
          { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
          { weatherDesc: [{ value: "Partly cloudy" }], chanceofrain: "20" },
          { weatherDesc: [{ value: "Clear" }], chanceofrain: "5" },
        ],
      },
      {
        date: "2026-06-19",
        maxtempC: "23",
        mintempC: "16",
        hourly: [
          { weatherDesc: [{ value: "Rain" }], chanceofrain: "60" },
          { weatherDesc: [{ value: "Cloudy" }], chanceofrain: "40" },
          { weatherDesc: [{ value: "Rain" }], chanceofrain: "55" },
        ],
      },
      {
        date: "2026-06-20",
        maxtempC: "21",
        mintempC: "14",
        hourly: [
          { weatherDesc: [{ value: "Overcast" }], chanceofrain: "30" },
          { weatherDesc: [{ value: "Cloudy" }], chanceofrain: "25" },
          { weatherDesc: [{ value: "Clear" }], chanceofrain: "10" },
        ],
      },
    ],
    nearest_area: [{ areaName: [{ value: "London" }] }],
  };
  return { ...base, ...overrides };
}

function mockFetch(body: Record<string, unknown>, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

describe("weather_current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers with weather:read capability", () => {
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: mockFetch(mockWttrResponse()) });
    const tool = registry.get("weather_current");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("weather_current");
    expect(tool!.capabilities).toEqual([{ name: "weather:read" }]);
  });

  it("fetches and parses wttr.in current weather", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherCurrentTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London", units: "C" }, ctx);
    expect(result.location).toBe("London");
    expect(result.temperature).toBe(22);
    expect(result.feelsLike).toBe(20);
    expect(result.humidity).toBe(65);
    expect(result.description).toBe("Partly cloudy");
    expect(result.windSpeed).toBe(15);
    expect(result.windDirection).toBe("SW");
    expect(result.visibility).toBe(10);
    expect(result.pressure).toBe(1013);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://wttr.in/London?format=j1",
      expect.any(Object),
    );
  });

  it("converts to Fahrenheit when units is F", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherCurrentTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London", units: "F" }, ctx);
    expect(result.temperature).toBe(72);
    expect(result.feelsLike).toBe(68);
  });

  it("is denied without weather:read capability", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: fetchMock });
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c1", tool: "weather_current", args: { location: "London" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("handles network errors gracefully", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: fetchMock });
    const res = await registry.invoke(
      { id: "c2", tool: "weather_current", args: { location: "London" } },
      weatherGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Network error/);
  });

  it("handles non-2xx responses", async () => {
    const fetchMock = mockFetch({}, 500);
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: fetchMock });
    const res = await registry.invoke(
      { id: "c3", tool: "weather_current", args: { location: "London" } },
      weatherGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 500/);
  });

  it("falls back to location name when nearest_area is missing", async () => {
    const data = mockWttrResponse({ nearest_area: undefined });
    const fetchMock = mockFetch(data);
    const tool = createWeatherCurrentTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "Berlin" }, ctx);
    expect(result.location).toBe("Berlin");
  });
});

describe("weather_forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers with weather:read capability", () => {
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: mockFetch(mockWttrResponse()) });
    const tool = registry.get("weather_forecast");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("weather_forecast");
    expect(tool!.capabilities).toEqual([{ name: "weather:read" }]);
  });

  it("fetches and parses forecast data", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherForecastTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London", days: 1 }, ctx);
    expect(result.location).toBe("London");
    expect(result.forecasts).toHaveLength(1);
    expect(result.forecasts[0].date).toBe("2026-06-18");
    expect(result.forecasts[0].maxTemp).toBe(25);
    expect(result.forecasts[0].minTemp).toBe(18);
    expect(result.forecasts[0].description).toBe("Partly cloudy");
    expect(result.forecasts[0].chanceOfRain).toBe(20);
  });

  it("converts forecast to Fahrenheit when units is F", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherForecastTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London", days: 1, units: "F" }, ctx);
    expect(result.forecasts[0].maxTemp).toBe(77);
    expect(result.forecasts[0].minTemp).toBe(64);
  });

  it("returns multiple days of forecast", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherForecastTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London", days: 3 }, ctx);
    expect(result.forecasts).toHaveLength(3);
  });

  it("defaults to 1 day forecast", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const tool = createWeatherForecastTool({ fetch: fetchMock });
    const result = await tool.handler({ location: "London" }, ctx);
    expect(result.forecasts).toHaveLength(1);
  });

  it("is denied without weather:read capability", async () => {
    const fetchMock = mockFetch(mockWttrResponse());
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: fetchMock });
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const res = await registry.invoke(
      { id: "c4", tool: "weather_forecast", args: { location: "London" } },
      noGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/capability denied/);
  });

  it("handles network errors gracefully", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: fetchMock });
    const res = await registry.invoke(
      { id: "c5", tool: "weather_forecast", args: { location: "London" } },
      weatherGrant,
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Network error/);
  });
});

describe("registerWeatherTools", () => {
  it("registers both weather tools", () => {
    const registry = new ToolRegistry();
    registerWeatherTools(registry, { fetch: mockFetch(mockWttrResponse()) });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("weather_current");
    expect(names).toContain("weather_forecast");
  });
});