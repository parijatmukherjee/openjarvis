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
let store: DesktopStore | null = null;

function isDev(): boolean {
  return process.env.NODE_ENV === "development" || process.env.OPENJARVIS_DEV === "1";
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    titleBarStyle: "hidden",
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

  return win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  if (isDev()) {
    await win.loadURL("http://localhost:5173/");
    win.webContents.openDevTools();
  } else {
    const html = join(__dirname, "..", "renderer", "index.html");
    await win.loadFile(html);
  }
}

function initializeStore(): DesktopStore {
  if (!store) {
    store = new DesktopStore();
  }
  return store;
}

export async function bootstrap(): Promise<void> {
  await app.whenReady();

  const createdStore = initializeStore();
  registerIpcHandlers(createdStore, ipcMain);
  registerWindowHandlers(ipcMain, () => BrowserWindow.getFocusedWindow() ?? null);

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
    void loadRenderer(mainWindow);
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
  void bootstrap();
}

if (import.meta.url.startsWith("file:")) {
  main();
}