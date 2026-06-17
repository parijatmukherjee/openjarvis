import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { DiscordChannelInfo } from "./types.js";

export interface DiscordToolClients {
  sendMessage(channelId: string, content: string): Promise<{ messageId: string }>;
  getChannel(channelId: string): Promise<DiscordChannelInfo>;
}

export function createDiscordSendTool(clients: DiscordToolClients): ToolDefinition<{ channelId: string; content: string }, { messageId: string }> {
  return {
    name: "discord_send",
    description: "Send a message to a Discord channel",
    args: z.object({
      channelId: z.string(),
      content: z.string(),
    }),
    result: z.object({ messageId: z.string() }),
    capabilities: [{ name: "discord:message" as const }],
    handler: async (args) => {
      return clients.sendMessage(args.channelId, args.content);
    },
  };
}

export function createDiscordReadTool(clients: DiscordToolClients): ToolDefinition<{ channelId: string }, DiscordChannelInfo> {
  return {
    name: "discord_read",
    description: "Read information about a Discord channel",
    args: z.object({
      channelId: z.string(),
    }),
    result: z.object({
      id: z.string(),
      name: z.string(),
      guildId: z.string().nullable(),
      type: z.enum(["text", "dm", "thread"]),
    }),
    capabilities: [{ name: "discord:read" as const }],
    handler: async (args) => {
      return clients.getChannel(args.channelId);
    },
  };
}

export function registerDiscordTools(
  registry: { register(tool: ToolDefinition<any, any>): void },
  clients: DiscordToolClients,
): void {
  registry.register(createDiscordSendTool(clients));
  registry.register(createDiscordReadTool(clients));
}