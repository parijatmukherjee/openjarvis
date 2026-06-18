import { describe, it, expect } from "vitest";
import { composeToolRegistry } from "../../src/nexus/tool-composition.js";
import type { DiscordToolClients } from "@openjarvis/channels";
import type { TelegramToolClients } from "@openjarvis/channels";
import type { EmailToolClients } from "@openjarvis/skills-email";
import { GraphCalendarClient } from "@openjarvis/skills-calendar";
import type { BrowserAutomation } from "@openjarvis/skills-web";
import { CronScheduler } from "@openjarvis/cron";

function makeDiscordClients(): DiscordToolClients {
  return {
    sendMessage: async () => ({ messageId: "msg-1" }),
    getChannel: async () => ({
      id: "ch-1",
      name: "general",
      guildId: "g-1",
      type: "text" as const,
    }),
    searchMessages: async () => [],
  };
}

function makeTelegramClients(): TelegramToolClients {
  return {
    sendMessage: async () => ({ messageId: 1 }),
    getChat: async () => ({
      id: 1,
      type: "private",
      title: null,
      username: null,
    }),
  };
}

function makeEmailClients(): EmailToolClients {
  const client = {
    listFolders: async () => [],
    listMessages: async () => [],
    getMessage: async () => {
      throw new Error("not found");
    },
    send: async () => "sent-1",
    search: async () => [],
  };
  return { gmail: client };
}

function makeBrowserAutomation(): BrowserAutomation {
  return {
    navigate: async () => ({ title: "Test", url: "https://example.com" }),
    click: async () => ({ clicked: true }),
    type: async () => ({ typed: true }),
    screenshot: async () => ({ data: "", mimeType: "image/png" }),
    accessibility: async () => ({ role: "page", value: "" }),
    getCookies: async () => [],
    setCookies: async () => {},
    clearCookies: async () => {},
    listTabs: async () => [],
    switchTab: async () => {},
    closeTab: async () => {},
    close: async () => {},
  };
}

describe("composeToolRegistry", () => {
  it("returns registry with platform tools when no config is provided", () => {
    const registry = composeToolRegistry({});
    expect(registry.list().map((t) => t.name)).toContain("disk_free");
  });

  it("registers discord tools when discord config is provided", () => {
    const registry = composeToolRegistry({
      discord: { clients: makeDiscordClients() },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("discord_send");
    expect(names).toContain("discord_read");
  });

  it("registers telegram tools when telegram config is provided", () => {
    const registry = composeToolRegistry({
      telegram: { clients: makeTelegramClients() },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("telegram_send");
    expect(names).toContain("telegram_read");
  });

  it("registers email tools when email config is provided", () => {
    const registry = composeToolRegistry({
      email: { clients: makeEmailClients() },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("email_search");
    expect(names).toContain("email_read");
    expect(names).toContain("email_draft");
    expect(names).toContain("email_send");
  });

  it("registers calendar tools when calendar config is provided", () => {
    const client = new GraphCalendarClient({
      getToken: async () => "test-token",
      fetch: async () => new Response(JSON.stringify({ value: [] }), { status: 200 }),
    });
    const registry = composeToolRegistry({
      calendar: { client },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("calendar_list");
    expect(names).toContain("calendar_get_events");
    expect(names).toContain("calendar_create");
    expect(names).toContain("calendar_update");
    expect(names).toContain("calendar_delete");
  });

  it("registers notion tools when notion config is provided", () => {
    const registry = composeToolRegistry({
      notion: { config: { token: "test-token" } },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("notion_query");
    expect(names).toContain("notion_get");
    expect(names).toContain("notion_create");
    expect(names).toContain("notion_update");
  });

  it("registers web tools when web config is provided", () => {
    const registry = composeToolRegistry({
      web: {},
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("web_fetch");
  });

  it("registers browser tools when web.browserAutomation is provided", () => {
    const registry = composeToolRegistry({
      web: { browserAutomation: makeBrowserAutomation() },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("web_fetch");
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_click");
    expect(names).toContain("browser_type");
    expect(names).toContain("browser_screenshot");
    expect(names).toContain("browser_accessibility");
    expect(names).toContain("browser_list_tabs");
    expect(names).toContain("browser_switch_tab");
    expect(names).toContain("browser_close_tab");
  });

  it("registers weather tools when weather config is provided", () => {
    const registry = composeToolRegistry({
      weather: {},
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("weather_current");
    expect(names).toContain("weather_forecast");
  });

  it("registers secrets tools when secrets config is provided", () => {
    const registry = composeToolRegistry({
      secrets: {},
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("secrets_get");
  });

  it("registers cron tools when cron config is provided", () => {
    const scheduler = new CronScheduler();
    const registry = composeToolRegistry({
      cron: { scheduler },
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("cron_schedule");
    expect(names).toContain("cron_list");
    expect(names).toContain("cron_cancel");
  });

  it("registers tools from multiple skills at once", () => {
    const registry = composeToolRegistry({
      discord: { clients: makeDiscordClients() },
      weather: {},
      secrets: {},
    });
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("discord_send");
    expect(names).toContain("discord_read");
    expect(names).toContain("weather_current");
    expect(names).toContain("weather_forecast");
    expect(names).toContain("secrets_get");
  });

  it("does not register unconfigured skills", () => {
    const registry = composeToolRegistry({
      weather: {},
    });
    const names = registry.list().map((t) => t.name);
    expect(names).not.toContain("discord_send");
    expect(names).not.toContain("telegram_send");
    expect(names).not.toContain("email_search");
    expect(names).not.toContain("calendar_list");
    expect(names).not.toContain("notion_query");
    expect(names).not.toContain("web_fetch");
    expect(names).not.toContain("browser_navigate");
    expect(names).not.toContain("secrets_get");
    expect(names).not.toContain("cron_schedule");
  });
});
