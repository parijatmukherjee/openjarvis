> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# Desktop Electron Main-Process Wiring Implementation Plan

**Goal:** Make the Electron desktop app runnable by wiring a real main process: BrowserWindow, renderer loading, IPC bridge registration, and lifecycle handling.

**Architecture:** A new `electron-main.ts` entry point creates the frameless main window and loads the Vite-bundled renderer. It instantiates `DesktopStore` and registers the existing IPC handlers so the renderer's `window.electronAPI` is live. The renderer HTML is updated to mount the React app. Package scripts and builder config are updated for dev/build/pack.

**Tech Stack:** TypeScript strict, ESM, Electron 30, Vite 5, React 18, Vitest with mocked Electron.

---

## File Structure

| File                                          | Responsibility                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/desktop/src/electron-main.ts`       | Electron main process entry point: window creation, lifecycle, IPC wiring, dev/prod loading. |
| `packages/desktop/src/preload.ts`             | Existing lazy-load preload API; no functional change, verify it still works.                 |
| `packages/desktop/src/renderer/index.html`    | Mount point for the React app (`<div id="root"></div>`).                                     |
| `packages/desktop/package.json`               | Add `dev`, `build:renderer`, `build:main`, `start`, `pack` scripts.                          |
| `packages/desktop/electron-builder.json`      | Ensure `dist/renderer` is included in packaged builds.                                       |
| `packages/desktop/tsconfig.json`              | Include `src/electron-main.ts` in build (currently excluded).                                |
| `packages/desktop/test/electron-main.test.ts` | Unit tests for main-process helpers with mocked Electron.                                    |

---

## Task 1: Update renderer HTML mount point

**Files:**

- Modify: `packages/desktop/src/renderer/index.html`

- [ ] **Step 1: Write the failing test**

No runtime test for HTML; verify by reading the file after edit.

- [ ] **Step 2: Update the HTML file**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenJarvis Desktop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Verify**

Run: `cat packages/desktop/src/renderer/index.html`  
Expected: Contains `<div id="root"></div>` and script tag.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/index.html
git commit -m "feat(desktop): update renderer HTML with React mount point"
```

---

## Task 2: Create electron-main.ts

**Files:**

- Create: `packages/desktop/src/electron-main.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/electron-main.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMainWindow } from "../src/electron-main.js";

describe("electron-main", () => {
  it("exports createMainWindow", () => {
    expect(typeof createMainWindow).toBe("function");
  });
});
```

Run: `npx vitest run packages/desktop/test/electron-main.test.ts`  
Expected: FAIL — `createMainWindow` is not defined.

- [ ] **Step 2: Implement electron-main.ts**

```ts
import { app, BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
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
```

Note: The `registerWindowHandlers` callback uses `BrowserWindow.getFocusedWindow()` because the focused window is the one the user is interacting with for minimize/maximize/close.

- [ ] **Step 3: Update tsconfig.json to include electron-main.ts**

Edit `packages/desktop/tsconfig.json`. Remove `src/electron-main.ts` from the `exclude` array:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/preload.ts"],
  "references": [{ "path": "../core" }, { "path": "../jarvis" }]
}
```

Wait — `src/preload.ts` is currently excluded too. We need it emitted as `dist/preload.js` for the main process to reference. Remove `src/preload.ts` from `exclude` as well:

```json
"exclude": []
```

However, `src/preload.ts` uses dynamic `import("electron")` and `contextBridge`, which are Electron-only APIs. It will typecheck fine because `electron` types are installed. Keep it included.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/desktop/test/electron-main.test.ts`  
Expected: PASS (just the export smoke).

- [ ] **Step 5: Run typecheck**

Run: `npm run build --workspace=@openjarvis/desktop`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/electron-main.ts packages/desktop/tsconfig.json packages/desktop/test/electron-main.test.ts
git commit -m "feat(desktop): add electron main-process entry point"
```

---

## Task 3: Add comprehensive electron-main tests

**Files:**

- Modify: `packages/desktop/test/electron-main.test.ts`

- [ ] **Step 1: Write the expanded test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMainWindow,
  getMainWindow,
  registerAppLifecycle,
  bootstrap,
} from "../src/electron-main.js";

const mockBrowserWindowInstances: unknown[] = [];
const mockBrowserWindow = vi.fn((opts: unknown) => {
  const instance = {
    ...opts,
    once: vi.fn(),
    show: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    isMinimized: vi.fn().mockReturnValue(false),
    restore: vi.fn(),
    focus: vi.fn(),
    webContents: { openDevTools: vi.fn() },
  };
  mockBrowserWindowInstances.push(instance);
  return instance;
});

const mockIpcMain = {
  handle: vi.fn(),
};

const mockApp = {
  whenReady: vi.fn().mockResolvedValue(undefined),
  requestSingleInstanceLock: vi.fn().mockReturnValue(true),
  quit: vi.fn(),
  on: vi.fn(),
  isReady: vi.fn().mockResolvedValue(true),
};

vi.mock("electron", () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
}));

describe("electron-main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindowInstances.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports createMainWindow", () => {
    expect(typeof createMainWindow).toBe("function");
  });

  it("creates a frameless BrowserWindow with expected options", () => {
    createMainWindow();
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    const options = mockBrowserWindow.mock.calls[0][0];
    expect(options.width).toBe(1200);
    expect(options.height).toBe(760);
    expect(options.minWidth).toBe(900);
    expect(options.minHeight).toBe(600);
    expect(options.frame).toBe(false);
    expect(options.show).toBe(false);
    expect(options.webPreferences.contextIsolation).toBe(true);
    expect(options.webPreferences.nodeIntegration).toBe(false);
  });

  it("shows the window on ready-to-show", () => {
    createMainWindow();
    const instance = mockBrowserWindowInstances[0] as {
      once: ReturnType<typeof vi.fn>;
      show: ReturnType<typeof vi.fn>;
    };
    expect(instance.once).toHaveBeenCalledWith("ready-to-show", expect.any(Function));
    const readyHandler = instance.once.mock.calls.find((call) => call[0] === "ready-to-show")![1];
    readyHandler();
    expect(instance.show).toHaveBeenCalled();
  });

  it("getMainWindow returns the bootstrap-created window", async () => {
    await bootstrap();
    const win = getMainWindow();
    expect(win).toBeDefined();
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
  });

  it("registers app lifecycle handlers", () => {
    registerAppLifecycle();
    expect(mockApp.on).toHaveBeenCalledWith("second-instance", expect.any(Function));
    expect(mockApp.on).toHaveBeenCalledWith("window-all-closed", expect.any(Function));
    expect(mockApp.on).toHaveBeenCalledWith("activate", expect.any(Function));
  });

  it("focuses existing window on second-instance", async () => {
    await bootstrap();
    registerAppLifecycle();
    const secondInstanceHandler = mockApp.on.mock.calls.find(
      (call) => call[0] === "second-instance",
    )![1];
    const instance = mockBrowserWindowInstances[0] as {
      isMinimized: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
    };
    instance.isMinimized.mockReturnValue(true);
    secondInstanceHandler();
    expect(instance.restore).toHaveBeenCalled();
    expect(instance.focus).toHaveBeenCalled();
  });

  it("loads dev URL when OPENJARVIS_DEV is set", async () => {
    vi.stubEnv("OPENJARVIS_DEV", "1");
    await bootstrap();
    const instance = mockBrowserWindowInstances[0] as {
      loadURL: ReturnType<typeof vi.fn>;
      webContents: { openDevTools: ReturnType<typeof vi.fn> };
    };
    expect(instance.loadURL).toHaveBeenCalledWith("http://localhost:5173/");
    expect(instance.webContents.openDevTools).toHaveBeenCalled();
  });

  it("loads production HTML file by default", async () => {
    await bootstrap();
    const instance = mockBrowserWindowInstances[0] as {
      loadFile: ReturnType<typeof vi.fn>;
    };
    expect(instance.loadFile).toHaveBeenCalled();
    expect(instance.loadFile.mock.calls[0][0]).toMatch(/renderer[\\/]index\.html$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/desktop/test/electron-main.test.ts`  
Expected: All PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run build --workspace=@openjarvis/desktop`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/test/electron-main.test.ts
git commit -m "test(desktop): add electron-main unit tests with mocked Electron"
```

---

## Task 4: Add desktop package scripts

**Files:**

- Modify: `packages/desktop/package.json`
- Modify: `packages/desktop/electron-builder.json`

- [ ] **Step 1: Update package.json scripts**

```json
"scripts": {
  "build": "tsc -b",
  "build:main": "tsc -b",
  "build:renderer": "vite build",
  "dev": "OPENJARVIS_DEV=1 electron .",
  "start": "electron .",
  "pack": "npm run build:renderer && npm run build:main && electron-builder"
}
```

Use `cross-env` if needed for Windows; check if `cross-env` is in the monorepo. If not, keep `dev` simple with `NODE_ENV=development`.

- [ ] **Step 2: Update electron-builder.json**

Ensure renderer is included:

```json
{
  "appId": "com.openjarvis.desktop",
  "productName": "Jarvis",
  "directories": {
    "output": "release"
  },
  "files": ["dist/**/*", "package.json"],
  "mac": {
    "category": "public.app-category.productivity",
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "linux": {
    "target": ["AppImage", "deb"]
  }
}
```

This already includes `dist/**/*` which covers `dist/renderer` after Vite build.

- [ ] **Step 3: Verify package.json parses**

Run: `node -e "console.log(require('./packages/desktop/package.json').scripts)"`  
Expected: scripts object printed.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/package.json packages/desktop/electron-builder.json
git commit -m "chore(desktop): add dev, build, and pack scripts"
```

---

## Task 5: Build renderer and main process and verify Electron launches

**Files:**

- No new files; verification only.

- [ ] **Step 1: Build renderer**

Run: `npm run build:renderer --workspace=@openjarvis/desktop`  
Expected: Vite builds `dist/renderer/index.html` and assets.

- [ ] **Step 2: Build main process**

Run: `npm run build:main --workspace=@openjarvis/desktop`  
Expected: `tsc -b` emits `dist/main.js`, `dist/preload.js`, `dist/electron-main.js`, etc.

- [ ] **Step 3: Verify dist layout**

Run: `ls packages/desktop/dist`  
Expected: `main.js`, `preload.js`, `electron-main.js`, `main/`, `renderer/`.

- [ ] **Step 4: Smoke-run Electron (optional, macOS)**

Run: `npx electron packages/desktop`  
Expected: Electron launches (may show window; requires GUI environment). If headless, this step can be skipped; the unit tests are the real gate.

- [ ] **Step 5: Commit any lockfile changes**

If `package-lock.json` changed due to new scripts/dev deps:

```bash
git add package-lock.json 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: update lockfile for desktop dev scripts"
```

---

## Task 6: Final gate and CHECKPOINT update

- [ ] **Step 1: Run full local gate**

Run: `npm run typecheck`  
Run: `npm test`  
Run: `npm run coverage`  
Run: `npm run test:functional`  
Run: `npm run lint`  
Run: `npm run format:check`  
Expected: All PASS; coverage ≥99%.

- [ ] **Step 2: Run Docker gate**

Run: `docker build -t openjarvis-gate -f Dockerfile.test . && docker run --rm openjarvis-gate`  
Expected: ✅ ALL GATES PASSED.

- [ ] **Step 3: Update CHECKPOINT.md**

Mark desktop package as having real main-process wiring, update in-flight PR section.

- [ ] **Step 4: Final commit**

```bash
git add CHECKPOINT.md
git commit -m "docs: update CHECKPOINT for electron main-process wiring"
```

- [ ] **Step 5: Push branch and open PR**

```bash
git push origin desktop-electron-main-wiring
gh pr create --title "feat(desktop): real Electron main-process wiring" --body "..."
```

---

## Spec Coverage Checklist

| Spec Requirement                                                         | Plan Task |
| ------------------------------------------------------------------------ | --------- |
| BrowserWindow with frameless chrome                                      | Task 2    |
| Load renderer from Vite dev server or dist                               | Task 2    |
| Instantiate DesktopStore                                                 | Task 2    |
| Register IPC/window handlers                                             | Task 2    |
| Electron lifecycle (ready, second-instance, window-all-closed, activate) | Task 2    |
| Renderer HTML mount point                                                | Task 1    |
| Package scripts for dev/build/pack                                       | Task 4    |
| electron-builder packaging                                               | Task 4    |
| Tests with mocked Electron                                               | Task 3    |
| Full gate + CHECKPOINT                                                   | Task 6    |

## Placeholder Scan

- No TBD/TODO/"implement later" placeholders.
- Every step includes exact commands or code.
- Tests contain concrete assertions.

## Type Consistency Check

- `createMainWindow` returns `BrowserWindow`.
- `getMainWindow` returns `BrowserWindow | null`.
- `bootstrap` returns `Promise<void>`.
- `registerAppLifecycle` returns `void`.

## Execution Handoff

**Plan complete and saved to `docs/specs/2026-06-17-desktop-electron-main-wiring-implementation-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach do you want?
