import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { DiscordChannelInfo, DiscordMessage } from "./types.js";
import { DiscordRest } from "./rest.js";

const DiscordMessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  guildId: z.string().nullable(),
  authorId: z.string(),
  authorUsername: z.string(),
  content: z.string(),
  timestamp: z.number(),
  editedTimestamp: z.number().nullable(),
  attachments: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      filename: z.string(),
      contentType: z.string().nullable(),
      size: z.number(),
    }),
  ),
});

export interface DiscordToolClients {
  sendMessage(channelId: string, content: string): Promise<{ messageId: string }>;
  getChannel(channelId: string): Promise<DiscordChannelInfo>;
  searchMessages(channelId: string, query: string, limit?: number): Promise<DiscordMessage[]>;
}

export function createDiscordSendTool(
  clients: DiscordToolClients,
): ToolDefinition<{ channelId: string; content: string }, { messageId: string }> {
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

export function createDiscordReadTool(
  clients: DiscordToolClients,
): ToolDefinition<{ channelId: string }, DiscordChannelInfo> {
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

export function createDiscordSearchTool(
  clients: DiscordToolClients,
): ToolDefinition<{ channelId: string; query: string; limit?: number }, DiscordMessage[]> {
  return {
    name: "discord_search",
    description: "Search for messages in a Discord channel",
    args: z.object({
      channelId: z.string(),
      query: z.string(),
      limit: z.number().optional().nullable(),
    }) as unknown as z.ZodType<{ channelId: string; query: string; limit?: number }>,
    result: z.array(DiscordMessageSchema),
    capabilities: [{ name: "discord:read" as const }],
    handler: async (args) => {
      return clients.searchMessages(args.channelId, args.query, args.limit ?? undefined);
    },
  };
}

export function createDiscordToolClients(token: string, fetchImpl?: typeof globalThis.fetch): DiscordToolClients {
  const rest = new DiscordRest(token, fetchImpl);
  return {
    sendMessage: (channelId, content) => rest.sendMessage(channelId, content),
    getChannel: (channelId) => rest.getChannel(channelId),
    searchMessages: (channelId, query, limit) => rest.searchMessages(channelId, query, limit),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerDiscordTools(
  registry: { register(tool: AnyToolDefinition): void },
  clients: DiscordToolClients,
): void {
  registry.register(createDiscordSendTool(clients));
  registry.register(createDiscordReadTool(clients));
  registry.register(createDiscordSearchTool(clients));
}