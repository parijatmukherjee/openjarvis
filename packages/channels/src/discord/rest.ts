import type { DiscordChannelInfo } from "./types.js";

export class DiscordRest {
  private readonly baseUrl = "https://discord.com/api/v10";

  constructor(private readonly token: string) {}

  async sendMessage(channelId: string, content: string): Promise<{ messageId: string }> {
    const res = await fetch(`${this.baseUrl}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`Discord REST sendMessage failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    return { messageId: data.id };
  }

  async getChannel(channelId: string): Promise<DiscordChannelInfo> {
    const res = await fetch(`${this.baseUrl}/channels/${channelId}`, {
      headers: { Authorization: `Bot ${this.token}` },
    });
    if (!res.ok) {
      throw new Error(`Discord REST getChannel failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      id: string;
      name: string;
      guild_id: string | null;
      type: number;
    };
    const type: DiscordChannelInfo["type"] =
      data.type === 1 ? "dm" : data.type === 11 ? "thread" : "text";
    return {
      id: data.id,
      name: data.name,
      guildId: data.guild_id,
      type,
    };
  }
}
