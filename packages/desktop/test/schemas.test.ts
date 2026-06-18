import { describe, it, expect } from "vitest";
import {
  appSettingsSchema,
  defaultAppSettings,
  userProfileSchema,
  defaultUserProfile,
} from "../src/main/schemas.js";

describe("appSettingsSchema", () => {
  it("parses empty input with all defaults", () => {
    const result = appSettingsSchema.parse({});
    expect(result.version).toBe(1);
    expect(result.theme).toBe("dark");
    expect(result.reducedMotion).toBe(false);
    expect(result.shortcut).toBe("CommandOrControl+Shift+J");
    expect(result.autoStart).toBe(true);
    expect(result.locale).toBe("en-US");
    expect(result.channels).toBeUndefined();
    expect(result.skills).toBeUndefined();
  });

  it("parses channels.discord with token and guilds", () => {
    const result = appSettingsSchema.parse({
      channels: {
        discord: { token: "abc123", guilds: ["guild-1"] },
      },
    });
    expect(result.channels?.discord?.token).toBe("abc123");
    expect(result.channels?.discord?.guilds).toEqual(["guild-1"]);
  });

  it("parses channels.discord without token (optional)", () => {
    const result = appSettingsSchema.parse({
      channels: { discord: { guilds: [] } },
    });
    expect(result.channels?.discord?.token).toBeUndefined();
    expect(result.channels?.discord?.guilds).toEqual([]);
  });

  it("parses channels.telegram with token", () => {
    const result = appSettingsSchema.parse({
      channels: { telegram: { token: "tg-token" } },
    });
    expect(result.channels?.telegram?.token).toBe("tg-token");
  });

  it("parses channels.telegram without token (optional)", () => {
    const result = appSettingsSchema.parse({
      channels: { telegram: {} },
    });
    expect(result.channels?.telegram?.token).toBeUndefined();
  });

  it("parses skills.email.gmail with defaults", () => {
    const result = appSettingsSchema.parse({
      skills: { email: { gmail: {} } },
    });
    expect(result.skills?.email?.gmail?.imap).toBe("imap.gmail.com");
    expect(result.skills?.email?.gmail?.smtp).toBe("smtp.gmail.com");
    expect(result.skills?.email?.gmail?.imapPort).toBe(993);
    expect(result.skills?.email?.gmail?.smtpPort).toBe(465);
  });

  it("parses skills.email.gmail with custom values", () => {
    const result = appSettingsSchema.parse({
      skills: {
        email: { gmail: { imap: "imap.custom.com", imapPort: 143 } },
      },
    });
    expect(result.skills?.email?.gmail?.imap).toBe("imap.custom.com");
    expect(result.skills?.email?.gmail?.smtp).toBe("smtp.gmail.com");
    expect(result.skills?.email?.gmail?.imapPort).toBe(143);
    expect(result.skills?.email?.gmail?.smtpPort).toBe(465);
  });

  it("parses skills.email.graph with defaults", () => {
    const result = appSettingsSchema.parse({
      skills: { email: { graph: {} } },
    });
    expect(result.skills?.email?.graph?.tenant).toBe("consumers");
    expect(result.skills?.email?.graph?.clientId).toBeUndefined();
  });

  it("parses skills.calendar with default provider", () => {
    const result = appSettingsSchema.parse({
      skills: { calendar: {} },
    });
    expect(result.skills?.calendar?.provider).toBe("live");
  });

  it("parses skills.calendar with google provider", () => {
    const result = appSettingsSchema.parse({
      skills: { calendar: { provider: "google" } },
    });
    expect(result.skills?.calendar?.provider).toBe("google");
  });

  it("parses skills.notion with token", () => {
    const result = appSettingsSchema.parse({
      skills: { notion: { token: "ntn-token" } },
    });
    expect(result.skills?.notion?.token).toBe("ntn-token");
  });

  it("parses skills.notion without token (optional)", () => {
    const result = appSettingsSchema.parse({
      skills: { notion: {} },
    });
    expect(result.skills?.notion?.token).toBeUndefined();
  });

  it("parses skills.weather with default provider", () => {
    const result = appSettingsSchema.parse({
      skills: { weather: {} },
    });
    expect(result.skills?.weather?.provider).toBe("wttr");
  });

  it("parses skills.weather with openweathermap provider", () => {
    const result = appSettingsSchema.parse({
      skills: { weather: { provider: "openweathermap" } },
    });
    expect(result.skills?.weather?.provider).toBe("openweathermap");
  });

  it("parses full settings with all fields", () => {
    const result = appSettingsSchema.parse({
      version: 1,
      theme: "light",
      reducedMotion: true,
      shortcut: "Alt+J",
      autoStart: false,
      locale: "fr-FR",
      channels: {
        discord: { token: "d-token", guilds: ["g1", "g2"] },
        telegram: { token: "t-token" },
      },
      skills: {
        email: {
          gmail: { imap: "imap.gmail.com", smtp: "smtp.gmail.com", imapPort: 993, smtpPort: 465 },
          graph: { clientId: "client-1", tenant: "organizations" },
        },
        calendar: { provider: "google" },
        notion: { token: "ntn" },
        weather: { provider: "openweathermap" },
      },
    });
    expect(result.theme).toBe("light");
    expect(result.channels?.discord?.token).toBe("d-token");
    expect(result.channels?.telegram?.token).toBe("t-token");
    expect(result.skills?.email?.gmail?.imap).toBe("imap.gmail.com");
    expect(result.skills?.email?.graph?.clientId).toBe("client-1");
    expect(result.skills?.calendar?.provider).toBe("google");
    expect(result.skills?.notion?.token).toBe("ntn");
    expect(result.skills?.weather?.provider).toBe("openweathermap");
  });

  it("rejects invalid calendar provider", () => {
    expect(() =>
      appSettingsSchema.parse({
        skills: { calendar: { provider: "yahoo" } },
      }),
    ).toThrow();
  });

  it("rejects invalid weather provider", () => {
    expect(() =>
      appSettingsSchema.parse({
        skills: { weather: { provider: "accuweather" } },
      }),
    ).toThrow();
  });
});

describe("defaultAppSettings", () => {
  it("has no channels by default", () => {
    expect(defaultAppSettings.channels).toBeUndefined();
  });

  it("has no skills by default", () => {
    expect(defaultAppSettings.skills).toBeUndefined();
  });
});

describe("userProfileSchema", () => {
  it("parses empty input with defaults", () => {
    const result = userProfileSchema.parse({});
    expect(result.version).toBe(1);
    expect(result.userName).toBe("User");
    expect(result.avatar).toBeUndefined();
  });
});

describe("defaultUserProfile", () => {
  it("has default userName", () => {
    expect(defaultUserProfile.userName).toBe("User");
  });
});
