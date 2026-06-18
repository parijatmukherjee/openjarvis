import type { TelegramMessage, TelegramChatInfo, TelegramBotConfig } from "./types.js";

export type FetchLike = typeof globalThis.fetch;

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: unknown;
}

interface TelegramRawMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  from?: {
    id: number;
    username?: string;
  };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramRawMessage;
}

export class TelegramBot {
  private baseUrl: string;
  private polling = false;
  private offset = 0;
  private handlers: ((msg: TelegramMessage) => void)[] = [];
  private pollAbort: AbortController | null = null;
  private readonly fetchFn: FetchLike;

  constructor(config: TelegramBotConfig, fetchFn?: FetchLike) {
    this.baseUrl = `https://api.telegram.org/bot${config.token}`;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async start(): Promise<void> {
    this.polling = true;
    this.pollLoop();
  }

  async stop(): Promise<void> {
    this.polling = false;
    this.pollAbort?.abort();
    this.pollAbort = null;
  }

  onMessage(handler: (msg: TelegramMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  async sendMessage(chatId: number, text: string): Promise<{ messageId: number }> {
    const res = await this.callApi("sendMessage", { chat_id: chatId, text });
    const data = res as { message_id: number };
    return { messageId: data.message_id };
  }

  async getChat(chatId: number): Promise<TelegramChatInfo> {
    const res = await this.callApi("getChat", { chat_id: chatId });
    const data = res as { id: number; type: string; title?: string; username?: string };
    return {
      id: data.id,
      type: data.type,
      title: data.title ?? null,
      username: data.username ?? null,
    };
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const res = await this.callApi("getUpdates", {
      offset: this.offset,
      timeout: 30,
    });
    return res as TelegramUpdate[];
  }

  private async callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}/${method}`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(`Telegram API ${method} failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as TelegramApiResponse;
    if (!json.ok) {
      throw new Error(`Telegram API ${method} error: ${json.description ?? "unknown"}`);
    }
    return json.result;
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        this.pollAbort = new AbortController();
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.offset = update.update_id + 1;
          if (update.message) {
            const mapped = this.mapMessage(update.message);
            for (const handler of this.handlers) {
              handler(mapped);
            }
          }
        }
      } catch {
        if (!this.polling) return;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private mapMessage(raw: TelegramRawMessage): TelegramMessage {
    return {
      id: raw.message_id,
      chatId: raw.chat.id,
      chatType: raw.chat.type as TelegramMessage["chatType"],
      fromId: raw.from?.id ?? 0,
      fromUsername: raw.from?.username ?? "",
      text: raw.text ?? "",
      timestamp: raw.date,
    };
  }
}