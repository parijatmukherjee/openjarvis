import { describe, it, expect, vi, beforeEach } from "vitest";

const mockShow = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockLoadFile = vi.fn().mockResolvedValue(undefined);
const mockOnce = vi.fn();
const mockOn = vi.fn();
const mockClose = vi.fn();
const mockIsMinimized = vi.fn().mockReturnValue(false);
const mockRestore = vi.fn();
const mockFocus = vi.fn();
const mockOpenDevTools = vi.fn();

let winInstance: Record<string, unknown>;

const MockBrowserWindow = vi.fn(() => {
  winInstance = {
    once: mockOnce,
    on: mockOn,
    show: mockShow,
    loadURL: mockLoadURL,
    loadFile: mockLoadFile,
    close: mockClose,
    isMinimized: mockIsMinimized,
    restore: mockRestore,
    focus: mockFocus,
    webContents: { openDevTools: mockOpenDevTools },
  };
  return winInstance;
});
(MockBrowserWindow as unknown as Record<string, unknown>).getFocusedWindow = vi
  .fn()
  .mockReturnValue(null);

const mockWhenReady = vi.fn().mockResolvedValue(undefined);
const mockRequestSingleInstanceLock = vi.fn().mockReturnValue(true);
const mockQuit = vi.fn();

const mockAppOn = vi.fn();
const mockApp = {
  whenReady: mockWhenReady,
  requestSingleInstanceLock: mockRequestSingleInstanceLock,
  quit: mockQuit,
  on: mockAppOn,
  isPackaged: true as boolean,
};

const mockIpcMainHandle = vi.fn();
const mockIpcMain = { handle: mockIpcMainHandle };

vi.mock("electron", () => ({
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  ipcMain: mockIpcMain,
}));

vi.mock("../src/main/store.js", () => ({
  DesktopStore: vi.fn().mockReturnValue({}),
}));

vi.mock("../src/main/ipc.js", () => ({
  registerIpcHandlers: vi.fn(),
  registerWindowHandlers: vi.fn(),
}));

function findCallArg(calls: unknown[][], eventName: string): unknown | undefined {
  return calls.find((c) => Array.isArray(c) && c[0] === eventName)?.[1];
}

describe("electron-main", () => {
  let createMainWindow: typeof import("../src/electron-main.js").createMainWindow;
  let getMainWindow: typeof import("../src/electron-main.js").getMainWindow;
  let bootstrap: typeof import("../src/electron-main.js").bootstrap;
  let registerAppLifecycle: typeof import("../src/electron-main.js").registerAppLifecycle;
  let mainFn: typeof import("../src/electron-main.js").main;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApp.isPackaged = true;
    mockRequestSingleInstanceLock.mockReturnValue(true);
    mockWhenReady.mockResolvedValue(undefined);
    mockLoadURL.mockResolvedValue(undefined);
    mockLoadFile.mockResolvedValue(undefined);

    vi.resetModules();

    const mod = await import("../src/electron-main.js");
    createMainWindow = mod.createMainWindow;
    getMainWindow = mod.getMainWindow;
    bootstrap = mod.bootstrap;
    registerAppLifecycle = mod.registerAppLifecycle;
    mainFn = mod.main;
  });

  describe("createMainWindow", () => {
    it("creates BrowserWindow with expected options", () => {
      createMainWindow();
      expect(MockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1200,
          height: 760,
          minWidth: 900,
          minHeight: 600,
          frame: false,
          show: false,
          webPreferences: expect.objectContaining({
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          }),
        }),
      );
    });

    it("registers ready-to-show handler that calls win.show()", () => {
      createMainWindow();
      const readyCb = findCallArg(mockOnce.mock.calls, "ready-to-show") as (() => void) | undefined;
      expect(readyCb).toBeDefined();
      mockShow.mockClear();
      readyCb!();
      expect(mockShow).toHaveBeenCalled();
    });

    it("registers closed handler that sets mainWindow to null", () => {
      createMainWindow();
      const closedCb = findCallArg(mockOn.mock.calls, "closed") as (() => void) | undefined;
      expect(closedCb).toBeDefined();
      closedCb!();
      expect(getMainWindow()).toBeNull();
    });
  });

  describe("getMainWindow", () => {
    it("returns null after closed handler fires", () => {
      createMainWindow();
      const closedCb = findCallArg(mockOn.mock.calls, "closed") as (() => void) | undefined;
      closedCb!();
      expect(getMainWindow()).toBeNull();
    });

    it("returns window after bootstrap", async () => {
      await bootstrap();
      expect(getMainWindow()).not.toBeNull();
    });
  });

  describe("registerAppLifecycle", () => {
    it("registers second-instance, window-all-closed, and activate handlers", () => {
      registerAppLifecycle();
      const channels = mockAppOn.mock.calls.map((c) => c[0] as string);
      expect(channels).toContain("second-instance");
      expect(channels).toContain("window-all-closed");
      expect(channels).toContain("activate");
    });
  });

  describe("bootstrap", () => {
    it("calls app.whenReady, creates store, registers IPC handlers, creates window, and loads renderer", async () => {
      const { registerIpcHandlers } = await import("../src/main/ipc.js");
      await bootstrap();
      expect(mockWhenReady).toHaveBeenCalled();
      expect(registerIpcHandlers).toHaveBeenCalled();
      expect(MockBrowserWindow).toHaveBeenCalled();
      expect(mockLoadFile).toHaveBeenCalled();
    });
  });

  describe("main", () => {
    it("calls requestSingleInstanceLock, registerAppLifecycle, and bootstrap", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(true);
      mainFn();
      expect(mockRequestSingleInstanceLock).toHaveBeenCalled();
      expect(mockAppOn).toHaveBeenCalled();
      expect(mockWhenReady).toHaveBeenCalled();
    });

    it("quits if single instance lock fails", () => {
      mockRequestSingleInstanceLock.mockReturnValue(false);
      mockQuit.mockClear();
      mainFn();
      expect(mockQuit).toHaveBeenCalled();
    });
  });

  describe("dev mode loading (OPENJARVIS_DEV=1)", () => {
    it("loads URL http://localhost:5173/ and opens DevTools", async () => {
      const origDev = process.env.OPENJARVIS_DEV;
      process.env.OPENJARVIS_DEV = "1";
      try {
        await bootstrap();
        expect(mockLoadURL).toHaveBeenCalledWith("http://localhost:5173/");
        expect(mockOpenDevTools).toHaveBeenCalled();
      } finally {
        if (origDev === undefined) delete process.env.OPENJARVIS_DEV;
        else process.env.OPENJARVIS_DEV = origDev;
      }
    });
  });

  describe("production loading", () => {
    it("loads dist/renderer/index.html file", async () => {
      mockApp.isPackaged = true;
      delete process.env.OPENJARVIS_DEV;
      await bootstrap();
      expect(mockLoadFile).toHaveBeenCalledWith(expect.stringContaining("index.html"));
    });
  });

  describe("handleActivate on macOS", () => {
    it("creates new window when mainWindow is null", async () => {
      registerAppLifecycle();
      const activateCb = findCallArg(mockAppOn.mock.calls, "activate") as (() => void) | undefined;
      expect(activateCb).toBeDefined();
      const closedCb = findCallArg(mockOn.mock.calls, "closed") as (() => void) | undefined;
      closedCb!();
      const prevCallCount = (MockBrowserWindow as unknown as { mock: { calls: unknown[] } }).mock
        .calls.length;
      activateCb!();
      const newCallCount = (MockBrowserWindow as unknown as { mock: { calls: unknown[] } }).mock
        .calls.length;
      expect(newCallCount).toBeGreaterThan(prevCallCount);
    });
  });

  describe("handleSecondInstance", () => {
    it("restores and focuses existing window", async () => {
      await bootstrap();
      registerAppLifecycle();
      const secondInstanceCb = findCallArg(mockAppOn.mock.calls, "second-instance") as
        | (() => void)
        | undefined;
      expect(secondInstanceCb).toBeDefined();
      mockIsMinimized.mockReturnValue(true);
      secondInstanceCb!();
      expect(mockRestore).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });
  });
});
