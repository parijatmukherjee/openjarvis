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
      const userText = (params.text as string | undefined) ?? "";
      // Mirror Chatbox behaviour: append the user message + a transient
      // jarvis placeholder up front so any other UI (e.g. ConversationPanel)
      // sees the user turn immediately and the jarvis turn grow in real
      // time as chunks arrive.
      const userId = String(++messageId);
      const jarvisId = String(++messageId);
      const userTimestamp = new Date().toLocaleTimeString();
      const jarvisTimestamp = new Date().toLocaleTimeString();
      messages.push({
        id: userId,
        type: "user",
        text: userText,
        timestamp: userTimestamp,
      });
      messages.push({
        id: jarvisId,
        type: "jarvis",
        text: "",
        timestamp: jarvisTimestamp,
      });
      notifyMessages();
      // engine.executeChatStream invokes onChunk synchronously as the model
      // streams; we forward each chunk to the consumer with our sessionId.
      await engine.executeChatStream(
        userText,
        (chunk) => {
          // Update the in-flight jarvis message in place. We mutate the
          // object directly (rather than replacing the array entry) so
          // existing references (e.g. inside React component state) keep
          // pointing at the same message.
          const jarvisMsg = messages.find((m) => m.id === jarvisId);
          if (jarvisMsg) {
            if (chunk.done && chunk.error) {
              jarvisMsg.text = `Error: ${chunk.error}`;
            } else {
              jarvisMsg.text += chunk.text;
            }
          }
          onChunk({
            sessionId,
            content: chunk.text,
            done: chunk.done,
            ...(chunk.error !== undefined ? { error: chunk.error } : {}),
          });
          // Notify subscribers on every chunk so ConversationPanel can
          // re-fetch and see the live in-progress text. Chatbox ignores this
          // (it does not subscribe to messages) so there is no risk of
          // overwriting its optimistic state.
          notifyMessages();
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
