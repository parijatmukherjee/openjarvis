import type { DiscordChannelInfo, DiscordMessage, DiscordRawMessage } from "./types.js";

export type FetchImpl = typeof globalThis.fetch;

interface RateBucket {
  remaining: number;
  resetAt: number;
}

export class DiscordRest {
  private readonly baseUrl = "https://discord.com/api/v10";
  private readonly buckets = new Map<string, RateBucket>();
  private readonly fetchImpl: FetchImpl;

  constructor(
    private readonly token: string,
    fetchImpl?: FetchImpl,
  ) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
  }

  async sendMessage(channelId: string, content: string): Promise<{ messageId: string }> {
    const data = await this.request<{ id: string }>(
      `/channels/${channelId}/messages`,
      "POST",
      { content },
    );
    return { messageId: data.id };
  }

  async getChannel(channelId: string): Promise<DiscordChannelInfo> {
    const data = await this.request<{
      id: string;
      name: string;
      guild_id: string | null;
      type: number;
    }>(`/channels/${channelId}`, "GET");
    const type: DiscordChannelInfo["type"] =
      data.type === 1 ? "dm" : data.type === 11 ? "thread" : "text";
    return {
      id: data.id,
      name: data.name,
      guildId: data.guild_id,
      type,
    };
  }

  async searchMessages(
    channelId: string,
    query: string,
    limit?: number,
  ): Promise<DiscordMessage[]> {
    const params = new URLSearchParams({ content: query });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    const data = await this.request<{ messages?: Array<Array<DiscordRawMessage>> }>(
      `/channels/${channelId}/messages/search?${params.toString()}`,
      "GET",
    );
    const rawMessages = data.messages?.flat() ?? [];
    return rawMessages.map((raw) => this.mapRawMessage(raw));
  }

  async registerCommands(
    applicationId: string,
    guildId: string,
    commands: Array<{ name: string; description: string; options?: unknown[] }>,
  ): Promise<Array<{ id: string }>> {
    const data = await this.request<Array<{ id: string }>>(
      `/applications/${applicationId}/guilds/${guildId}/commands`,
      "PUT",
      commands,
    );
    return data;
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const maxAttempts = 4;
    let attempt = 0;

    while (true) {
      attempt++;

      await this.waitForBucket(path);

      const headers: Record<string, string> = {
        Authorization: `Bot ${this.token}`,
      };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const init: RequestInit = {
        method,
        headers,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);

      this.updateBucket(path, res);

      if (res.status === 429) {
        const retryAfter = this.parseRetryAfter(res);
        await this.sleep(retryAfter * 1000);
        continue;
      }

      if (res.status >= 500 && attempt < maxAttempts) {
        const backoff = Math.pow(2, attempt - 1) * 1000;
        await this.sleep(backoff);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Discord REST ${method} ${path} failed: ${res.status} ${text}`);
      }

      return (await res.json()) as T;
    }
  }

  private parseRetryAfter(res: Response): number {
    const header = res.headers.get("Retry-After");
    if (header) {
      const parsed = Number(header);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 1;
  }

  private updateBucket(_path: string, res: Response): void {
    const bucketId = res.headers.get("X-RateLimit-Bucket");
    if (bucketId) {
      const remaining = Number(res.headers.get("X-RateLimit-Remaining") ?? "1");
      const reset = Number(res.headers.get("X-RateLimit-Reset") ?? "0");
      this.buckets.set(bucketId, { remaining, resetAt: reset * 1000 });
    }
  }

  private async waitForBucket(_path: string): Promise<void> {
    for (const bucket of this.buckets.values()) {
      if (bucket.remaining <= 0 && Date.now() < bucket.resetAt) {
        await this.sleep(bucket.resetAt - Date.now());
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapRawMessage(raw: DiscordRawMessage): DiscordMessage {
    return {
      id: raw.id,
      channelId: raw.channel_id,
      guildId: raw.guild_id ?? null,
      authorId: raw.author.id,
      authorUsername: raw.author.username,
      content: raw.content,
      timestamp: new Date(raw.timestamp).getTime(),
      editedTimestamp: raw.edited_timestamp ? new Date(raw.edited_timestamp).getTime() : null,
      attachments: raw.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        contentType: a.content_type ?? null,
        size: a.size,
      })),
    };
  }
}