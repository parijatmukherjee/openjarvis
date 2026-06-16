import type { AppSettings, UserProfile } from "../main/schemas.js";

export interface ElectronAPI {
  getSystemLocale: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<void>;
  getProfile: () => Promise<UserProfile>;
  setProfile: (profile: UserProfile) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
