import { z } from "zod";

export const appSettingsSchema = z.object({
  version: z.literal(1).default(1),
  theme: z.enum(["dark", "light"]).default("dark"),
  reducedMotion: z.boolean().default(false),
  shortcut: z.string().default("CommandOrControl+Shift+J"),
  autoStart: z.boolean().default(true),
  locale: z.string().default("en-US"),
  model: z
    .object({
      provider: z.enum(["ollama", "ollama-cloud", "openai-compat"]).default("ollama"),
      model: z.string().default("llama3"),
      baseUrl: z.string().default("http://127.0.0.1:11434"),
      apiKey: z.string().optional(),
    })
    .default({ provider: "ollama", model: "llama3", baseUrl: "http://127.0.0.1:11434" }),
  channels: z
    .object({
      discord: z
        .object({
          token: z.string().optional(),
          guilds: z.array(z.string()).default([]),
        })
        .optional(),
      telegram: z
        .object({
          token: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  skills: z
    .object({
      email: z
        .object({
          gmail: z
            .object({
              imap: z.string().default("imap.gmail.com"),
              smtp: z.string().default("smtp.gmail.com"),
              imapPort: z.number().default(993),
              smtpPort: z.number().default(465),
            })
            .optional(),
          graph: z
            .object({
              clientId: z.string().optional(),
              tenant: z.string().default("consumers"),
            })
            .optional(),
        })
        .optional(),
      calendar: z
        .object({
          provider: z.enum(["live", "google"]).default("live"),
        })
        .optional(),
      notion: z
        .object({
          token: z.string().optional(),
        })
        .optional(),
      weather: z
        .object({
          provider: z.enum(["wttr", "openweathermap"]).default("wttr"),
          apiKey: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = appSettingsSchema.parse({});

export const userProfileSchema = z.object({
  version: z.literal(1).default(1),
  userName: z.string().trim().max(64).default("User"),
  avatar: z.string().optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const defaultUserProfile: UserProfile = userProfileSchema.parse({});
