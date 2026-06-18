import { Client, GatewayIntentBits } from "discord.js";
import type { Message } from "discord.js";
import type { DiscordMessage } from "./types.js";

export interface DiscordGatewayConfig {
  token: string;
  guilds: string[];
}

export class DiscordGateway {
  private client: Client;

  constructor(private readonly config: DiscordGatewayConfig) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
  }

  async start(): Promise<void> {
    await this.client.login(this.config.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  onMessage(handler: (msg: DiscordMessage) => void): () => void {
    this.client.on("messageCreate", (raw: Message) => {
      if (raw.author.bot) return;
      handler(this.mapMessage(raw));
    });
    return () => {
      this.client.off("messageCreate", () => {});
    };
  }

  private mapMessage(raw: Message): DiscordMessage {
    return {
      id: raw.id,
      channelId: raw.channelId,
      guildId: raw.guildId,
      authorId: raw.author.id,
      authorUsername: raw.author.username,
      content: raw.content,
      timestamp: raw.createdTimestamp,
      editedTimestamp: raw.editedTimestamp,
      attachments: raw.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.name,
        contentType: a.contentType,
        size: a.size,
      })),
    };
  }
}
