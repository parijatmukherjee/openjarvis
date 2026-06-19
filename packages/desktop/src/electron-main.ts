import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DesktopStore } from "./main/store.js";
import { registerIpcHandlers, registerWindowHandlers } from "./main/ipc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 760;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;

function isDev(): boolean {
  return !app.isPackaged || process.env.OPENJARVIS_DEV === "1";
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  if (isDev()) {
    const devUrl = "http://localhost:5173/";
    try {
      await win.loadURL(devUrl);
      // DevTools is intentionally not auto-opened: on headless / Xvfb
      // launches the DevTools Autofill CDP probe logs a noisy
      // "Request Autofill.enable failed" error every time. Users who
      // want DevTools can open it manually (Ctrl+Shift+I / Cmd+Opt+I).
    } catch {
      const html = join(__dirname, "renderer", "index.html");
      await win.loadFile(html);
    }
  } else {
    const html = join(__dirname, "renderer", "index.html");
    await win.loadFile(html);
  }
}

function initializeStore(): DesktopStore {
  return new DesktopStore();
}

export async function bootstrap(): Promise<void> {
  await app.whenReady();

  const createdStore = initializeStore();
  registerIpcHandlers(createdStore, ipcMain, () => mainWindow);
  registerWindowHandlers(ipcMain, () => mainWindow);

  mainWindow = createMainWindow();
  await loadRenderer(mainWindow);
}

function handleSecondInstance(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

function handleWindowAllClosed(): void {
  if (process.platform !== "darwin") {
    app.quit();
  }
}

function handleActivate(): void {
  if (mainWindow === null) {
    mainWindow = createMainWindow();
    loadRenderer(mainWindow).catch((err) => {
      console.error("Failed to load renderer:", err);
    });
  }
}

export function registerAppLifecycle(): void {
  app.on("second-instance", handleSecondInstance);
  app.on("window-all-closed", handleWindowAllClosed);
  app.on("activate", handleActivate);
}

export function main(): void {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  registerAppLifecycle();
  bootstrap().catch((err) => {
    console.error("Failed to bootstrap:", err);
    app.quit();
  });
}

if (import.meta.url.startsWith("file:")) {
  main();
}
