import type { AppSettings, UserProfile } from "../main/schemas.js";
import type { Task, AgentView, MessageView } from "../renderer/lib/nexus-types.js";

export interface ElectronAPI {
  getSystemLocale: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<void>;
  resetSettings: () => Promise<AppSettings>;
  getProfile: () => Promise<UserProfile>;
  setProfile: (profile: UserProfile) => Promise<void>;
  nexusGetTasks: () => Promise<Task[]>;
  nexusGetAgents: () => Promise<AgentView[]>;
  nexusGetMessages: () => Promise<MessageView[]>;
  nexusClearMessages: () => Promise<MessageView[]>;
  nexusExecuteIntent: (
    action: string,
    params: Record<string, unknown>,
  ) => Promise<{
    success: boolean;
    spoken?: string;
    visual?: unknown[];
    error?: string;
  }>;
  nexusChatStream: (text: string) => Promise<{ sessionId: string }>;
  nexusCancelChatStream: (sessionId: string) => Promise<void>;
  modelList: (provider: string, baseUrl: string, apiKey?: string) => Promise<string[]>;
  getEnvApiKeys: () => Promise<{ ollamaApiKey: string | null; openaiApiKey: string | null }>;
  onNexusEvent: (callback: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
