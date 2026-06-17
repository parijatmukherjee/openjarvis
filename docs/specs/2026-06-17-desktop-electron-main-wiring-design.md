# Desktop Electron Main-Process Wiring

**Date:** 2026-06-17  
**Scope:** `@openjarvis/desktop`  
**Status:** Approved for implementation  
**Depends on:** PR #40 (settings persistence + user profile) merged into `main`

## Goal

Make the Electron desktop app actually runnable by wiring a real main process that:

- Creates a `BrowserWindow` with the neon dashboard dimensions and frameless chrome.
- Loads the renderer from the Vite-bundled `dist/renderer/index.html` in production, or from the Vite dev server in development.
- Instantiates `DesktopStore` and registers IPC handlers from PR #40 so `window.electronAPI` is available to the renderer.
- Registers window-control handlers so the custom `WindowControls` buttons (minimize/maximize/close/settings) work.
- Handles the standard Electron lifecycle: `app.whenReady()`, second-instance lock, `window-all-closed`, `before-quit`.
- Builds and packages correctly via `electron-builder`.

## Non-Goals

- Voice/audio loop (next PR).
- Auto-updater, crash reporter, or telemetry.
- Multi-window support (only the main HUD window).
- Native menu bar or system tray.
- Real Nexus engine connection (mock bridge remains).

## Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│                         Main Process                           │
│  electron-main.ts                                              │
│       │                                                        │
│       ├──▶ createMainWindow() ──▶ BrowserWindow               │
│       │       │                                                │
│       │       └──▶ loadURL/loadFile (Vite dev or dist)        │
│       │                                                        │
│       ├──▶ DesktopStore                                        │
│       │       │                                                │
│       └──▶ registerIpcHandlers(store, ipcMain)                 │
│               └──▶ registerWindowHandlers(ipcMain, getWindow) │
└────────────────────────────────────────────────────────────────┘
                              │
                         preload.ts (contextBridge)
                              │
┌────────────────────────────────────────────────────────────────┐
│                         Renderer                               │
│  App.tsx → DashboardLayout / OnboardingFlow / SettingsPanel   │
│       │                                                        │
│       └──▶ window.electronAPI                                  │
└────────────────────────────────────────────────────────────────┘
```

### Components

1. **`packages/desktop/src/electron-main.ts`** — Entry point for the Electron main process.
   - `createMainWindow()` — builds the frameless `BrowserWindow`, loads the renderer.
   - `getMainWindow()` — returns the current main window or `null`.
   - `app.whenReady()` — initializes store, IPC, and creates the window.
   - `app.on("second-instance")` — focuses existing window instead of launching a second copy.
   - `app.on("window-all-closed")` — quits on Windows/Linux, stays alive on macOS until `app.quit()`.
   - `app.on("before-quit")`/`"quit"` — clean shutdown.

2. **`packages/desktop/src/preload.ts`** — already exists; exposes `electronAPI` via `contextBridge`. No functional change needed.

3. **`packages/desktop/src/renderer/index.html`** — update the placeholder HTML to include `<div id="root"></div>` and a `<script type="module" src="./main.tsx"></script>` so Vite can bundle the React app.

4. **`packages/desktop/package.json`** — add main-process scripts:
   - `"dev": "vite build --watch & electron ."` (or a cross-platform dev runner)
   - `"build:renderer": "vite build"`
   - `"build:main": "tsc -b"`
   - `"pack": "npm run build:renderer && npm run build:main && electron-builder"`
   - `"start": "electron ."`

5. **`packages/desktop/electron-builder.json`** — ensure it packages `dist/**/*`, `package.json`, and the built renderer assets.

6. **Tests**
   - `packages/desktop/test/electron-main.test.ts` — unit tests for main-process helpers using mocked Electron APIs. Since `electron` requires a runtime, mock the module and assert behavior.
   - Add a smoke test that verifies `electron-main.ts` exports a `createMainWindow` function without crashing when Electron is unavailable.
   - Update `preload.smoke.test.ts` if needed.

## Window Configuration

```ts
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 760,
  minWidth: 900,
  minHeight: 600,
  frame: false,
  titleBarStyle: "hidden",
  show: false,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});

mainWindow.once("ready-to-show", () => mainWindow.show());
```

- Frameless so the custom `WindowControls` chrome is visible.
- `show: false` + `ready-to-show` prevents white-flash on startup.
- Preload path resolves to the emitted JS next to `main.js` in `dist/`.

## Loading Strategy

Use a `NODE_ENV` or `OPENJARVIS_DEV` environment variable to pick the renderer source:

```ts
const isDev = process.env.NODE_ENV === "development" || process.env.OPENJARVIS_DEV === "1";

if (isDev) {
  // Vite dev server
  await mainWindow.loadURL("http://localhost:5173/");
  mainWindow.webContents.openDevTools();
} else {
  // Production bundle
  const html = path.join(__dirname, "..", "renderer", "index.html");
  await mainWindow.loadFile(html);
}
```

## IPC Wiring

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { DesktopStore } from "./main/store.js";
import { registerIpcHandlers, registerWindowHandlers } from "./main/ipc.js";

const store = new DesktopStore();
registerIpcHandlers(store, ipcMain);
registerWindowHandlers(ipcMain, () => BrowserWindow.getFocusedWindow() ?? null);
```

## Build Flow

1. `npm run build:renderer` — Vite bundles `src/renderer` → `dist/renderer`.
2. `npm run build:main` — `tsc -b` compiles `src/electron-main.ts`, `src/preload.ts`, `src/main/**/*.ts` → `dist/`.
3. `electron-builder` packages `dist/` into the platform installer.

## Testing Strategy

- **Unit tests with mocked `electron`**: mock `app`, `BrowserWindow`, `ipcMain`, `screen` to verify:
  - `createMainWindow()` creates a window with the expected options.
  - Lifecycle handlers are registered.
  - Second-instance focuses the existing window.
  - `getMainWindow()` returns the created window.
- **Smoke test**: importing `electron-main.ts` does not crash when `electron` is unavailable (guard dynamic imports or module structure).
- **Gate**: all existing tests still pass; coverage stays ≥99%.

## Risks & Mitigations

| Risk                                                              | Mitigation                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Electron runtime unavailable in unit tests                        | Mock `electron` module; keep pure logic separate from Electron API calls. |
| Renderer build output path mismatch between Vite and main process | Centralize path constants and verify in tests.                            |
| Preload path wrong in packaged app                                | Use `__dirname` relative to emitted `dist/main.js`.                       |
| macOS app lifecycle different from Windows/Linux                  | Add platform-aware `window-all-closed` handling.                          |
| Typecheck fails because `electron-main.ts` imports electron       | Add `@types/node` and `electron` dev deps (already done in PR #40).       |

## Acceptance Criteria

- [ ] `npm run dev` opens a real Electron window with the dashboard.
- [ ] `WindowControls` minimize/maximize/close work through the IPC bridge.
- [ ] `SettingsPanel` persists changes to disk via the real `DesktopStore`.
- [ ] `Header` greets the persisted user name in the real app.
- [ ] `npm run pack` produces a platform installer via `electron-builder`.
- [ ] All gates pass: `typecheck`, `lint`, `format:check`, `test`, `coverage`, `test:functional`, Docker gate.

## Follow-up Work

1. **Voice loop PR** — add Web Audio API microphone input and wake-word detection.
2. **Onboarding completion persistence** — store `onboardingComplete` in `AppSettings` once onboarding ends.
3. **Real Nexus bridge** — connect the renderer to a running `NexusEngine` instead of the mock bridge.
