const { contextBridge, ipcRenderer } = require("electron");

const api = {
  getSystemLocale: () => ipcRenderer.invoke("locale:getSystemLocale"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  getSettings: () => ipcRenderer.invoke("settings:load"),
  setSettings: (settings: unknown) => ipcRenderer.invoke("settings:save", settings),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getProfile: () => ipcRenderer.invoke("profile:load"),
  setProfile: (profile: unknown) => ipcRenderer.invoke("profile:save", profile),
  nexusGetTasks: () => ipcRenderer.invoke("nexus:getTasks"),
  nexusGetAgents: () => ipcRenderer.invoke("nexus:getAgents"),
  nexusGetMessages: () => ipcRenderer.invoke("nexus:getMessages"),
  nexusClearMessages: () => ipcRenderer.invoke("nexus:clearMessages"),
  nexusExecuteIntent: (action: string, params: Record<string, unknown>) =>
    ipcRenderer.invoke("nexus:executeIntent", action, params),
  nexusChatStream: (text: string) =>
    ipcRenderer.invoke("nexus:chatStream", text) as Promise<{ sessionId: string }>,
  nexusCancelChatStream: (sessionId: string) =>
    ipcRenderer.invoke("nexus:cancelChatStream", sessionId) as Promise<void>,
  modelList: (provider: string, baseUrl: string, apiKey?: string) =>
    ipcRenderer.invoke("model:list", provider, baseUrl, apiKey),
  getEnvApiKeys: () => ipcRenderer.invoke("env:getApiKeys"),
  onNexusEvent: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("nexus:event", handler);
    return () => {
      ipcRenderer.removeListener("nexus:event", handler as (...args: unknown[]) => void);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
