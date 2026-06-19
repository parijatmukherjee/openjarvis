import { ToolRegistry, diskFreeTool, createDocumentTool } from "@openjarvis/core";
import type { DocumentConverter } from "@openjarvis/core";
import type { DiscordToolClients } from "@openjarvis/channels";
import type { TelegramToolClients } from "@openjarvis/channels";
import { registerDiscordTools, registerTelegramTools } from "@openjarvis/channels";
import type { EmailToolClients } from "@openjarvis/skills-email";
import { registerEmailTools } from "@openjarvis/skills-email";
import type { CalendarConfig } from "@openjarvis/skills-calendar";
import { registerCalendarTools } from "@openjarvis/skills-calendar";
import { GraphCalendarClient } from "@openjarvis/skills-calendar";
import type { NotionConfig } from "@openjarvis/skills-notion";
import { registerNotionTools } from "@openjarvis/skills-notion";
import type { WebFetchConfig, BrowserAutomation } from "@openjarvis/skills-web";
import { registerWebFetchTools, registerBrowserTools } from "@openjarvis/skills-web";
import type { WeatherConfig } from "@openjarvis/skills-weather";
import { registerWeatherTools } from "@openjarvis/skills-weather";
import type { OpClientConfig } from "@openjarvis/skills-secrets";
import { registerSecretsTools } from "@openjarvis/skills-secrets";
import type { CronScheduler } from "@openjarvis/cron";
import { registerCronTools } from "@openjarvis/cron";

export interface ToolCompositionConfig {
  discord?: { clients: DiscordToolClients };
  telegram?: { clients: TelegramToolClients };
  email?: { clients: EmailToolClients };
  calendar?: {
    client: GraphCalendarClient;
    config?: CalendarConfig;
  };
  notion?: { config: NotionConfig };
  web?: { config?: WebFetchConfig; browserAutomation?: BrowserAutomation };
  weather?: { config?: WeatherConfig };
  secrets?: { config?: OpClientConfig };
  document?: { converter: DocumentConverter };
  cron?: { scheduler: CronScheduler };
}

export function composeToolRegistry(
  config: ToolCompositionConfig,
  logger?: import("@openjarvis/core").Logger,
): ToolRegistry {
  const registry = new ToolRegistry(logger);
  registry.register(diskFreeTool);

  if (config.document) {
    registry.register(createDocumentTool(config.document.converter));
  }

  if (config.discord) {
    registerDiscordTools(registry, config.discord.clients);
  }

  if (config.telegram) {
    registerTelegramTools(registry, config.telegram.clients);
  }

  if (config.email) {
    registerEmailTools(registry, config.email.clients);
  }

  if (config.calendar) {
    registerCalendarTools(registry, config.calendar.client);
  }

  if (config.notion) {
    registerNotionTools(registry, config.notion.config);
  }

  if (config.web) {
    registerWebFetchTools(registry, config.web.config ?? {});
    if (config.web.browserAutomation) {
      registerBrowserTools(registry, config.web.browserAutomation);
    }
  }

  if (config.weather) {
    registerWeatherTools(registry, config.weather.config ?? {});
  }

  if (config.secrets) {
    registerSecretsTools(registry, config.secrets.config ?? {});
  }

  if (config.cron) {
    registerCronTools(registry, config.cron.scheduler);
  }

  return registry;
}
