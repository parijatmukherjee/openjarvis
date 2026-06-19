import { readFile, open, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { configDir } from "@openjarvis/core";
import {
  appSettingsSchema,
  userProfileSchema,
  chatMessageSchema,
  defaultAppSettings,
  defaultUserProfile,
  type AppSettings,
  type UserProfile,
  type ChatMessage,
} from "./schemas.js";

const MAX_PERSISTED_MESSAGES = 500;

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

  private async readJson<T>(
    file: string,
    fallback: T,
    schema: z.ZodSchema<T, z.ZodTypeDef, unknown>,
  ): Promise<T> {
    try {
      const text = await readFile(this.path(file), "utf-8");
      const parsed = JSON.parse(text) as unknown;
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      console.warn(`[DesktopStore] Schema validation failed for ${file}, using defaults`);
      return fallback;
    } catch (err) {
      if (this.isEnoent(err)) return fallback;
      return fallback;
    }
  }

  private isEnoent(err: unknown): err is { code: string } {
    return err instanceof Error && "code" in err && (err as { code: string }).code === "ENOENT";
  }

  private async writeJson(file: string, data: unknown): Promise<void> {
    await this.ensureDir();
    const temp = `${this.path(file)}.tmp`;
    const handle = await open(temp, "w", 0o600);
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, this.path(file));
  }

  async loadSettings(): Promise<AppSettings> {
    return this.readJson("settings.json", defaultAppSettings, appSettingsSchema);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.writeJson("settings.json", appSettingsSchema.parse(settings));
  }

  async resetSettings(): Promise<AppSettings> {
    await this.writeJson("settings.json", defaultAppSettings);
    return defaultAppSettings;
  }

  async loadProfile(): Promise<UserProfile> {
    return this.readJson("profile.json", defaultUserProfile, userProfileSchema);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const parsed = userProfileSchema.parse(profile);
    const safe = parsed.userName.length === 0 ? defaultUserProfile : parsed;
    await this.writeJson("profile.json", safe);
  }

  async loadMessages(): Promise<ChatMessage[]> {
    return this.readJson<ChatMessage[]>("messages.json", [], this.chatMessagesArraySchema());
  }

  async appendMessage(message: ChatMessage): Promise<void> {
    const safe = chatMessageSchema.parse(message);
    const current = await this.loadMessages();
    const next = [...current, safe].slice(-MAX_PERSISTED_MESSAGES);
    await this.writeJson("messages.json", next);
  }

  async clearMessages(): Promise<void> {
    await this.writeJson("messages.json", []);
  }

  private chatMessagesArraySchema(): z.ZodSchema<ChatMessage[], z.ZodTypeDef, unknown> {
    return z.array(chatMessageSchema).max(MAX_PERSISTED_MESSAGES);
  }
}
