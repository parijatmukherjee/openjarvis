import type { ElectronAPI } from "./renderer/types/electron.js";

export async function initPreload(): Promise<void> {
  const { contextBridge, ipcRenderer } = await import("electron");

  const api: ElectronAPI = {
    getSystemLocale: () => ipcRenderer.invoke("locale:getSystemLocale"),
    minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
    maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
    closeWindow: () => ipcRenderer.invoke("window:close"),
    getSettings: () => ipcRenderer.invoke("settings:load"),
    setSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
    getProfile: () => ipcRenderer.invoke("profile:load"),
    setProfile: (profile) => ipcRenderer.invoke("profile:save", profile),
  };

  contextBridge.exposeInMainWorld("electronAPI", api);
}
