import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { TelegramChatInfo } from "./types.js";

export interface TelegramToolClients {
  sendMessage(chatId: number, text: string): Promise<{ messageId: number }>;
  getChat(chatId: number): Promise<TelegramChatInfo>;
}

export function createTelegramSendTool(
  clients: TelegramToolClients,
): ToolDefinition<{ chatId: number; text: string }, { messageId: number }> {
  return {
    name: "telegram_send",
    description: "Send a message to a Telegram chat",
    args: z.object({
      chatId: z.number(),
      text: z.string(),
    }),
    result: z.object({ messageId: z.number() }),
    capabilities: [{ name: "telegram:message" as const }],
    handler: async (args) => {
      return clients.sendMessage(args.chatId, args.text);
    },
  };
}

export function createTelegramReadTool(
  clients: TelegramToolClients,
): ToolDefinition<{ chatId: number }, TelegramChatInfo> {
  return {
    name: "telegram_read",
    description: "Read information about a Telegram chat",
    args: z.object({
      chatId: z.number(),
    }),
    result: z.object({
      id: z.number(),
      type: z.string(),
      title: z.string().nullable(),
      username: z.string().nullable(),
    }),
    capabilities: [{ name: "telegram:read" as const }],
    handler: async (args) => {
      return clients.getChat(args.chatId);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerTelegramTools(
  registry: { register(tool: AnyToolDefinition): void },
  clients: TelegramToolClients,
): void {
  registry.register(createTelegramSendTool(clients));
  registry.register(createTelegramReadTool(clients));
}
