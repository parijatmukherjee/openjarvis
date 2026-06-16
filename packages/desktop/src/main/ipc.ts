import type { BrowserWindow, IpcMain } from "electron";
import type { DesktopStore } from "./store.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

export function registerIpcHandlers(store: DesktopStore, ipcMain: MinimalIpcMain): void {
  ipcMain.handle("settings:load", () => store.loadSettings());
  ipcMain.handle("settings:save", (_event, settings) => store.saveSettings(settings));
  ipcMain.handle("profile:load", () => store.loadProfile());
  ipcMain.handle("profile:save", (_event, profile) => store.saveProfile(profile));

  ipcMain.handle("locale:getSystemLocale", () => {
    const electron = process.versions.electron ? require("electron") : { app: null };
    return electron.app?.getLocale?.() ?? Intl.DateTimeFormat().resolvedOptions().locale;
  });
}

export function registerWindowHandlers(ipcMain: MinimalIpcMain, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("window:minimize", () => {
    getWindow()?.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    const win = getWindow();
    if (win?.isMaximized()) win?.unmaximize();
    else win?.maximize();
  });
  ipcMain.handle("window:close", () => {
    getWindow()?.close();
  });
}
