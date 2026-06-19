import type { NexusBridge, Task, AgentView, MessageView } from "./nexus-types.js";

export function createIpcNexusBridge(): NexusBridge {
  const messages: MessageView[] = [];
  let nextId = 1;
  const messageSubscribers = new Set<() => void>();
  const notifyMessages = (): void => {
    for (const sub of messageSubscribers) sub();
  };

  const api = (): Window["electronAPI"] | undefined => window.electronAPI;

  const refreshFromMain = async (): Promise<void> => {
    const electron = api();
    if (!electron?.nexusGetMessages) return;
    try {
      const persisted = await electron.nexusGetMessages();
      messages.length = 0;
      messages.push(...persisted);
    } catch {
      // Best-effort: keep the local cache if main fails to respond.
    }
  };

  return {
    async getTasks(): Promise<Task[]> {
      const electron = api();
      if (electron?.nexusGetTasks) {
        return electron.nexusGetTasks();
      }
      throw new Error("Electron API not available. This app must run inside Electron.");
    },

    async getAgents(): Promise<AgentView[]> {
      const electron = api();
      if (electron?.nexusGetAgents) {
        return electron.nexusGetAgents();
      }
      throw new Error("Electron API not available. This app must run inside Electron.");
    },

    async getMessages(): Promise<MessageView[]> {
      // Lazy seed from main on first call so chat history survives app reloads.
      if (messages.length === 0) {
        await refreshFromMain();
      }
      return [...messages];
    },

    async executeIntent(action: string, params: Record<string, unknown>): Promise<void> {
      // Main process owns persistence now; this method just invokes the IPC and
      // then re-fetches the canonical list so any subscribers see the new
      // user / jarvis / system messages.
      const electron = api();
      if (electron?.nexusExecuteIntent) {
        const result = await electron.nexusExecuteIntent(action, params);
        // Suppress unused locals — result.spoken/error is consumed by main.
        void result;
      }
      await refreshFromMain();
      // Keep nextId ahead of the highest persisted id so any future local-only
      // message could still be unique.
      for (const m of messages) {
        const n = Number(m.id);
        if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
      }
      notifyMessages();
    },

    subscribeToEvents(handler: (event: unknown) => void): () => void {
      const electron = api();
      if (electron?.onNexusEvent) {
        return electron.onNexusEvent(handler);
      }
      return () => {};
    },

    subscribeToMessages(handler: () => void): () => void {
      messageSubscribers.add(handler);
      return () => {
        messageSubscribers.delete(handler);
      };
    },
  };
}
