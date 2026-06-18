import { z } from "zod";
import type { ToolDefinition, ToolContext } from "@openjarvis/core";

export interface WeatherConfig {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const WeatherCurrentArgs = z.object({
  location: z.string(),
  units: z.enum(["C", "F"]).optional().default("C"),
});

const WeatherCurrentResult = z.object({
  location: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  description: z.string(),
  windSpeed: z.number(),
  windDirection: z.string(),
  visibility: z.number(),
  pressure: z.number(),
});

type WeatherCurrentArgs = z.infer<typeof WeatherCurrentArgs>;
type WeatherCurrentResult = z.infer<typeof WeatherCurrentResult>;

const WeatherForecastArgs = z.object({
  location: z.string(),
  days: z.number().int().min(1).max(3).optional().default(1),
  units: z.enum(["C", "F"]).optional().default("C"),
});

const ForecastDay = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  description: z.string(),
  chanceOfRain: z.number(),
});

const WeatherForecastResult = z.object({
  location: z.string(),
  forecasts: z.array(ForecastDay),
});

type WeatherForecastArgs = z.infer<typeof WeatherForecastArgs>;
type WeatherForecastResult = z.infer<typeof WeatherForecastResult>;

function toF(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  weatherDesc: { value: string }[];
  winddir16Point: string;
  windspeedKmph: string;
  visibility: string;
  pressure: string;
}

interface WttrForecastDay {
  date: string;
  maxtempC: string;
  mintempC: string;
  hourly: {
    weatherDesc: { value: string }[];
    chanceofrain: string;
  }[];
}

interface WttrResponse {
  current_condition?: WttrCurrentCondition[];
  weather?: WttrForecastDay[];
  nearest_area?: { areaName: { value: string }[] }[];
}

async function fetchWttr(location: string, config: WeatherConfig): Promise<WttrResponse> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const encoded = encodeURIComponent(location);
    const url = `https://wttr.in/${encoded}?format=j1`;
    const response = await doFetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as WttrResponse;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function createWeatherCurrentTool(
  config: WeatherConfig = {},
): ToolDefinition<WeatherCurrentArgs, WeatherCurrentResult> {
  return {
    name: "weather_current",
    description: "Get current weather for a location",
    args: WeatherCurrentArgs as unknown as z.ZodType<WeatherCurrentArgs>,
    result: WeatherCurrentResult as unknown as z.ZodType<WeatherCurrentResult>,
    capabilities: [{ name: "weather:read" as const }],
    handler: async (args: WeatherCurrentArgs, _ctx: ToolContext): Promise<WeatherCurrentResult> => {
      const data = await fetchWttr(args.location, config);
      const cc = data.current_condition?.[0];
      if (!cc) {
        throw new Error("no current condition data in response");
      }
      const areaName = data.nearest_area?.[0]?.areaName?.[0]?.value ?? args.location;
      const units = args.units ?? "C";
      const tempC = Number(cc.temp_C);
      const feelsLikeC = Number(cc.FeelsLikeC);
      return {
        location: areaName,
        temperature: units === "F" ? toF(tempC) : tempC,
        feelsLike: units === "F" ? toF(feelsLikeC) : feelsLikeC,
        humidity: Number(cc.humidity),
        description: cc.weatherDesc[0]?.value ?? "",
        windSpeed: Number(cc.windspeedKmph),
        windDirection: cc.winddir16Point,
        visibility: Number(cc.visibility),
        pressure: Number(cc.pressure),
      };
    },
  };
}

export function createWeatherForecastTool(
  config: WeatherConfig = {},
): ToolDefinition<WeatherForecastArgs, WeatherForecastResult> {
  return {
    name: "weather_forecast",
    description: "Get weather forecast for a location (1-3 days)",
    args: WeatherForecastArgs as unknown as z.ZodType<WeatherForecastArgs>,
    result: WeatherForecastResult as unknown as z.ZodType<WeatherForecastResult>,
    capabilities: [{ name: "weather:read" as const }],
    handler: async (
      args: WeatherForecastArgs,
      _ctx: ToolContext,
    ): Promise<WeatherForecastResult> => {
      const data = await fetchWttr(args.location, config);
      const areaName = data.nearest_area?.[0]?.areaName?.[0]?.value ?? args.location;
      const days = args.days ?? 1;
      const units = args.units ?? "C";
      const forecasts = (data.weather ?? []).slice(0, days).map((day: WttrForecastDay) => {
        const maxC = Number(day.maxtempC);
        const minC = Number(day.mintempC);
        const middayHour = day.hourly[Math.floor(day.hourly.length / 2)];
        return {
          date: day.date,
          maxTemp: units === "F" ? toF(maxC) : maxC,
          minTemp: units === "F" ? toF(minC) : minC,
          description: middayHour?.weatherDesc[0]?.value ?? "",
          chanceOfRain: Number(middayHour?.chanceofrain ?? 0),
        };
      });
      return { location: areaName, forecasts };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerWeatherTools(
  registry: { register(tool: AnyToolDefinition): void },
  config: WeatherConfig = {},
): void {
  registry.register(createWeatherCurrentTool(config));
  registry.register(createWeatherForecastTool(config));
}
