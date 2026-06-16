import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { configDir } from "@openjarvis/core";
import {
  appSettingsSchema,
  userProfileSchema,
  defaultAppSettings,
  defaultUserProfile,
  type AppSettings,
  type UserProfile,
} from "./schemas.js";

export class DesktopStore {
  private readonly configDir: string;

  constructor(configDirOverride?: string) {
    this.configDir = configDirOverride ?? configDir();
  }

  private path(file: string): string {
    return join(this.configDir, file);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.configDir, { recursive: true });
  }

  private async readJson<T>(file: string, fallback: T, schema: z.ZodSchema<T, any, any>): Promise<T> {
    try {
      const text = await readFile(this.path(file), "utf-8");
      const parsed = JSON.parse(text) as unknown;
      const result = schema.safeParse(parsed);
      if (result.success) return result.data as T;
      return schema.parse({ ...fallback, ...(parsed as Record<string, unknown>) }) as T;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return fallback;
      }
      return fallback;
    }
  }

  private async writeJson(file: string, data: unknown): Promise<void> {
    await this.ensureDir();
    const temp = `${this.path(file)}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2), "utf-8");
    await rename(temp, this.path(file));
  }

  async loadSettings(): Promise<AppSettings> {
    return this.readJson("settings.json", defaultAppSettings, appSettingsSchema);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.writeJson("settings.json", appSettingsSchema.parse(settings));
  }

  async loadProfile(): Promise<UserProfile> {
    return this.readJson("profile.json", defaultUserProfile, userProfileSchema);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const parsed = userProfileSchema.parse(profile);
    const safe = parsed.userName.length === 0 ? defaultUserProfile : parsed;
    await this.writeJson("profile.json", safe);
  }
}
