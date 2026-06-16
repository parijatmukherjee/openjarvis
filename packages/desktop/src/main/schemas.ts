import { z } from "zod";

export const appSettingsSchema = z.object({
  version: z.literal(1).default(1),
  theme: z.enum(["dark", "light"]).default("dark"),
  reducedMotion: z.boolean().default(false),
  shortcut: z.string().default("CommandOrControl+Shift+J"),
  autoStart: z.boolean().default(true),
  locale: z.string().default("en-US"),
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
