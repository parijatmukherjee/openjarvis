import { randomUUID } from "node:crypto";
import type { NexusEngine, TaskBoard, AgentPool } from "@openjarvis/jarvis/nexus";
import type { EventBus } from "@openjarvis/jarvis";
import type { AgentView, MessageView, StreamChunk } from "./nexus-types.js";

export type { AgentView, MessageView };
export type { NexusBridge } from "./nexus-types.js";

export function createNexusBridge(
  engine: NexusEngine,
  taskBoard: TaskBoard,
  agentPool: AgentPool,
  eventBus: EventBus,
): import("./nexus-types.js").NexusBridge {
  const messages: MessageView[] = [];
  let messageId = 0;
  const messageSubscribers = new Set<() => void>();
  const notifyMessages = (): void => {
    for (const sub of messageSubscribers) sub();
  };
  const cancelUnsubs = new Map<string, () => void>();

  return {
    async getTasks() {
      return taskBoard.getTaskHistory(undefined, 50);
    },

    async getAgents() {
      const agents = await agentPool.list();
      return agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: (a.active ? "active" : "idle") as AgentView["status"],
        description: `${a.role} agent`,
        capabilities: a.capabilities as AgentView["capabilities"],
        lastActivity: "—",
        tasksCompleted: 0,
      }));
    },

    async getMessages() {
      return messages;
    },

    async executeIntent(action, params) {
      messages.push({
        id: String(++messageId),
        type: "user",
        text: `${action}: ${JSON.stringify(params)}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      notifyMessages();

      try {
        await engine.execute(
          { action, params, confidence: 1, ambiguous: false },
          {
            sessionId: randomUUID(),
            userId: "desktop-user",
            recentIntents: [],
            currentTime: new Date(),
          },
        );
      } catch (err) {
        messages.push({
          id: String(++messageId),
          type: "system",
          text: `Error: ${String(err)}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        notifyMessages();
      }
    },

    async executeIntentStream(
      action: string,
      params: Record<string, unknown>,
      onChunk: (chunk: StreamChunk) => void,
      abort?: AbortSignal,
    ): Promise<{ sessionId: string }> {
      // Chat is the only action that streams. Other actions fall through to
      // the non-streaming path so callers can use the streaming API uniformly.
      if (action !== "chat") {
        await this.executeIntent(action, params);
        return { sessionId: "" };
      }
      const sessionId = randomUUID();
      // engine.executeChatStream invokes onChunk synchronously as the model
      // streams; we forward each chunk to the consumer with our sessionId.
      await engine.executeChatStream(
        params.text as string,
        (chunk) => {
          onChunk({
            sessionId,
            content: chunk.text,
            done: chunk.done,
            ...(chunk.error !== undefined ? { error: chunk.error } : {}),
          });
        },
        abort,
      );
      // Stash a no-op unsub so cancelChatStream has a consistent contract
      // with the IPC bridge. In-process cancellation is driven by the
      // AbortSignal owned by the caller; nothing to clean up here.
      cancelUnsubs.set(sessionId, () => {
        cancelUnsubs.delete(sessionId);
      });
      return { sessionId };
    },

    async cancelChatStream(sessionId: string): Promise<void> {
      const unsub = cancelUnsubs.get(sessionId);
      if (unsub) {
        unsub();
      }
    },

    subscribeToEvents(handler) {
      const sub = eventBus.subscribe("nexus", (event) => {
        handler(event.payload);
      });
      return () => sub.unsubscribe();
    },

    subscribeToMessages(handler) {
      messageSubscribers.add(handler);
      return () => {
        messageSubscribers.delete(handler);
      };
    },
  };
}
