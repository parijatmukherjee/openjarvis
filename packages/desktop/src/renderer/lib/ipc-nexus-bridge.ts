import type { NexusBridge, Task, AgentView, MessageView, StreamChunk } from "./nexus-types.js";

export function createIpcNexusBridge(): NexusBridge {
  const messages: MessageView[] = [];
  let nextId = 1;
  const messageSubscribers = new Set<() => void>();
  const notifyMessages = (): void => {
    for (const sub of messageSubscribers) sub();
  };
  const cancelUnsubs = new Map<string, () => void>();

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

    async executeIntentStream(
      action: string,
      params: Record<string, unknown>,
      onChunk: (chunk: StreamChunk) => void,
      abort?: AbortSignal,
    ): Promise<{ sessionId: string }> {
      const electron = api();
      // Chat is the only action that streams. Other actions (e.g. check_weather)
      // keep their original non-streaming behaviour so callers can use the
      // streaming path uniformly without branching on action.
      if (action !== "chat" || !electron?.nexusChatStream) {
        await this.executeIntent(action, params);
        return { sessionId: "" };
      }
      const { sessionId } = await electron.nexusChatStream(params.text as string);
      // Bridge to the bus: the main process publishes chunks on
      // `nexus:chat:${sessionId}:chunk`. We forward them as StreamChunk.
      const unsub = this.subscribeToEvents((event) => {
        const evt = event as { topic?: string; payload?: StreamChunk };
        if (evt.topic === `nexus:chat:${sessionId}:chunk` && evt.payload) {
          onChunk(evt.payload);
        }
      });
      cancelUnsubs.set(sessionId, unsub);
      // Honour the optional AbortSignal by tearing down the subscription and
      // forwarding to the IPC cancel channel as soon as the signal fires.
      if (abort) {
        const onAbort = (): void => {
          if (abort.aborted) {
            void this.cancelChatStream(sessionId);
          }
        };
        if (abort.aborted) {
          void this.cancelChatStream(sessionId);
        } else {
          abort.addEventListener("abort", onAbort, { once: true });
        }
      }
      return { sessionId };
    },

    async cancelChatStream(sessionId: string): Promise<void> {
      const unsub = cancelUnsubs.get(sessionId);
      if (unsub) {
        unsub();
        cancelUnsubs.delete(sessionId);
      }
      const electron = api();
      if (electron?.nexusCancelChatStream) {
        await electron.nexusCancelChatStream(sessionId);
      }
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
