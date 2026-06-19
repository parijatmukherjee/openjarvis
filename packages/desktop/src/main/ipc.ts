import { NexusEngine } from "@openjarvis/jarvis/nexus";
import { RuleBasedRouter } from "@openjarvis/jarvis/nexus";
import { InProcessAgentPool } from "@openjarvis/jarvis/nexus";
import { RuleBasedSynthesizer } from "@openjarvis/jarvis/nexus";
import { TaskBoard } from "@openjarvis/jarvis/nexus";
import { SimpleEventBus } from "@openjarvis/jarvis";
import { createModelClient } from "@openjarvis/jarvis/model";
import type { ModelClient } from "@openjarvis/jarvis/model";
import { randomUUID } from "node:crypto";
import type { IpcMain, BrowserWindow } from "electron";
import type { DesktopStore } from "./store.js";
import type { AppSettings } from "./schemas.js";

type MinimalIpcMain = Pick<IpcMain, "handle">;

let engine: NexusEngine | null = null;
let taskBoard: TaskBoard | null = null;
let agentPool: InProcessAgentPool | null = null;
let currentModelClient: ModelClient | undefined;
let eventBus: SimpleEventBus | null = null;
let eventSubscriptions: Array<() => void> = [];

function resetEngine(): void {
  for (const unsub of eventSubscriptions) {
    try { unsub(); } catch { /* ignore */ }
  }
  eventSubscriptions = [];
  engine = null;
  taskBoard = null;
  agentPool = null;
  eventBus = null;
}

function createEngine(client?: ModelClient): { engine: NexusEngine; taskBoard: TaskBoard; agentPool: InProcessAgentPool } {
  const bus = new SimpleEventBus();
  const router = new RuleBasedRouter(client);
  const pool = new InProcessAgentPool(client);
  const synthesizer = new RuleBasedSynthesizer(client);
  taskBoard = new TaskBoard(bus);
  eventBus = bus;
  agentPool = pool;
  engine = new NexusEngine({
    intentRouter: router,
    agentPool: pool,
    synthesizer,
    eventBus: bus,
    maxConcurrentAgents: 3,
    defaultTimeoutMs: 30000,
  });
  return { engine, taskBoard, agentPool: pool };
}

function getEngine(): { engine: NexusEngine; taskBoard: TaskBoard; agentPool: InProcessAgentPool } {
  if (engine && taskBoard && agentPool) return { engine, taskBoard, agentPool };
  return createEngine(currentModelClient);
}

function createClientFromSettings(settings: AppSettings): ModelClient | undefined {
  try {
    const modelConfig = {
      provider: settings.model.provider,
      model: settings.model.model,
      baseUrl: settings.model.baseUrl,
      ...(settings.model.apiKey ? { apiKey: settings.model.apiKey } : {}),
    };
    return createModelClient(modelConfig);
  } catch {
    return undefined;
  }
}

async function getSystemLocale(): Promise<string> {
  if (process.versions.electron) {
    const { app } = await import("electron");
    return app.getLocale?.() ?? Intl.DateTimeFormat().resolvedOptions().locale;
  }
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export function registerIpcHandlers(store: DesktopStore, ipcMain: MinimalIpcMain, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("settings:load", async () => {
    const settings = await store.loadSettings();
    if (settings.model && !settings.model.apiKey) {
      const envKey = settings.model.provider === "ollama-cloud"
        ? process.env.OLLAMA_API_KEY
        : settings.model.provider === "openai-compat"
          ? process.env.OPENAI_API_KEY
          : process.env.OLLAMA_API_KEY;
      if (envKey) {
        settings.model.apiKey = envKey;
      }
    }
    return settings;
  });
  ipcMain.handle("settings:save", async (_event, settings) => {
    const result = await store.saveSettings(settings);
    const newClient = createClientFromSettings(settings as AppSettings);
    if (newClient !== currentModelClient) {
      currentModelClient = newClient;
      resetEngine();
    }
    return result;
  });
  ipcMain.handle("settings:reset", async () => {
    const defaults = await store.resetSettings();
    currentModelClient = undefined;
    resetEngine();
    return defaults;
  });
  ipcMain.handle("profile:load", () => store.loadProfile());
  ipcMain.handle("profile:save", (_event, profile) => store.saveProfile(profile));
  ipcMain.handle("locale:getSystemLocale", getSystemLocale);

  ipcMain.handle("env:getApiKeys", () => {
    return {
      ollamaApiKey: process.env.OLLAMA_API_KEY ?? null,
      openaiApiKey: process.env.OPENAI_API_KEY ?? null,
    };
  });

  ipcMain.handle("nexus:getTasks", async () => {
    const { taskBoard: tb } = getEngine();
    const tasks = await tb.getTaskHistory(undefined, 50);
    return tasks.map((t) => ({
      id: t.id,
      agentId: t.agentId,
      description: t.description,
      status: t.status,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      durationMs: t.durationMs,
      error: t.error,
    }));
  });

  ipcMain.handle("nexus:getAgents", async () => {
    const { agentPool: pool } = getEngine();
    const agents = await pool.list();
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.active ? ("active" as const) : ("idle" as const),
      description: `${a.role} agent`,
      capabilities: a.capabilities,
      lastActivity: "—",
      tasksCompleted: 0,
    }));
  });

  ipcMain.handle("nexus:getMessages", async () => {
    return [];
  });

  ipcMain.handle(
    "nexus:executeIntent",
    async (_event, action: string, params: Record<string, unknown>) => {
      const { engine: eng } = getEngine();
      try {
        const synthesis = await eng.execute(
          { action, params, confidence: 1, ambiguous: false },
          {
            sessionId: randomUUID(),
            userId: "desktop-user",
            recentIntents: [],
            currentTime: new Date(),
          },
        );
        return { success: true, spoken: synthesis.spoken, visual: synthesis.visual };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle("nexus:subscribeToEvents", async () => {
    if (!eventBus) return [];
    const sub = eventBus.subscribe("nexus", (event) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("nexus:event", event.payload);
      }
    });
    eventSubscriptions.push(sub.unsubscribe);
    return [];
  });

  ipcMain.handle("model:list", async (_event, provider: string, baseUrl: string, apiKey?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (apiKey && (provider === "ollama-cloud" || provider === "openai-compat")) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      if (provider === "ollama") {
        const url = `${baseUrl}/api/tags`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          console.error(`[model:list] Ollama ${url} returned ${response.status}`);
          return [];
        }
        const data = (await response.json()) as Record<string, unknown>;
        const models = data.models as Array<Record<string, string>> | undefined;
        return (models ?? []).map((m) => m.name);
      }
      const url = `${baseUrl}/models`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers });
      if (!response.ok) {
        console.error(`[model:list] ${url} returned ${response.status}`);
        return [];
      }
      const data = (await response.json()) as { data?: Array<Record<string, string>> };
      return (data.data ?? []).map((m) => m.id);
    } catch (err) {
      console.error(`[model:list] Error fetching models for ${provider} at ${baseUrl}:`, err);
      return [];
    }
  });
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