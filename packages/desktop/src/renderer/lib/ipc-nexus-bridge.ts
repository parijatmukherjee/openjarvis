import type { NexusBridge, Task, AgentView, MessageView } from "./nexus-types.js";

export function createIpcNexusBridge(): NexusBridge {
  const messages: MessageView[] = [];
  let nextId = 1;
  const messageSubscribers = new Set<() => void>();
  const notifyMessages = (): void => {
    for (const sub of messageSubscribers) sub();
  };

  return {
    async getTasks(): Promise<Task[]> {
      const api = window.electronAPI;
      if (api?.nexusGetTasks) {
        return api.nexusGetTasks();
      }
      throw new Error("Electron API not available. This app must run inside Electron.");
    },

    async getAgents(): Promise<AgentView[]> {
      const api = window.electronAPI;
      if (api?.nexusGetAgents) {
        return api.nexusGetAgents();
      }
      throw new Error("Electron API not available. This app must run inside Electron.");
    },

    async getMessages(): Promise<MessageView[]> {
      return [...messages];
    },

    async executeIntent(action: string, params: Record<string, unknown>): Promise<void> {
      const text = params.text as string | undefined;

      if (text) {
        messages.push({
          id: String(nextId++),
          type: "user",
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        notifyMessages();
      }

      const api = window.electronAPI;
      if (api?.nexusExecuteIntent) {
        const result = await api.nexusExecuteIntent(action, params);
        if (result.success && result.spoken) {
          messages.push({
            id: String(nextId++),
            type: "jarvis",
            text: result.spoken,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          notifyMessages();
        } else if (!result.success && result.error) {
          messages.push({
            id: String(nextId++),
            type: "system",
            text: `Error: ${result.error}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          notifyMessages();
        }
      }
    },

    subscribeToEvents(handler: (event: unknown) => void): () => void {
      const api = window.electronAPI;
      if (api?.onNexusEvent) {
        return api.onNexusEvent(handler);
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
