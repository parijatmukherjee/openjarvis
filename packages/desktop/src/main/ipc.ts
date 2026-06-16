import type { BrowserWindow, IpcMain } from "electron";
import type { DesktopStore } from "./store.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

async function getSystemLocale(): Promise<string> {
  // Electron is an optional peer. Use a dynamic import when running under Electron,
  // otherwise fall back to the browser/Node Intl locale so tests and pre-renderer
  // code paths stay deterministic.
  if (process.versions.electron) {
    const { app } = await import("electron");
    return app.getLocale?.() ?? Intl.DateTimeFormat().resolvedOptions().locale;
  }
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export function registerIpcHandlers(store: DesktopStore, ipcMain: MinimalIpcMain): void {
  ipcMain.handle("settings:load", () => store.loadSettings());
  ipcMain.handle("settings:save", (_event, settings) => store.saveSettings(settings));
  ipcMain.handle("profile:load", () => store.loadProfile());
  ipcMain.handle("profile:save", (_event, profile) => store.saveProfile(profile));
  ipcMain.handle("locale:getSystemLocale", getSystemLocale);
}

export function registerWindowHandlers(
  ipcMain: MinimalIpcMain,
  getWindow: () => BrowserWindow | null,
): void {
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
