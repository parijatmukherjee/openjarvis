import WebSocket from "ws";
import type {
  DiscordMessage,
  GatewayPayload,
  HelloData,
  IdentifyData,
  ResumeData,
  DiscordRawMessage,
  GatewayDispatchEvent,
} from "./types.js";
import { GatewayOP } from "./types.js";

export interface DiscordGatewayConfig {
  token: string;
  guilds: string[];
}

export interface WSLike {
  on(event: "open", listener: () => void): void;
  on(event: "message", listener: (data: Buffer) => void): void;
  on(event: "close", listener: (code: number, reason: Buffer) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  close(code?: number, data?: string): void;
  send(data: string): void;
  readyState: number;
}

const CLOSED = 3;
const DEFAULT_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENTS = 32767;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;
const JITTER_FACTOR = 0.25;

type DispatchHandler = (event: GatewayDispatchEvent) => void;
type MessageHandler = (msg: DiscordMessage) => void;

export class DiscordGateway {
  private ws: WSLike | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private gatewayUrl: string | null = null;
  private reconnecting = false;
  private stopped = false;
  private messageHandlers: Set<MessageHandler> = new Set();
  private dispatchHandlers: Set<DispatchHandler> = new Set();

  private readonly createWs: (url: string) => WSLike;
  private readonly urlResolver: () => Promise<string>;

  constructor(
    private readonly config: DiscordGatewayConfig,
    wsImpl?: (url: string) => WSLike,
    urlResolver?: () => Promise<string>,
  ) {
    this.createWs = wsImpl ?? ((url: string) => new WebSocket(url) as WSLike);
    this.urlResolver = urlResolver ?? (() => this.fetchGatewayUrl());
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.gatewayUrl = await this.urlResolver();
    this.connect(this.gatewayUrl);
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    if (this.ws && this.ws.readyState !== CLOSED) {
      this.ws.close(1000, "gateway stop");
    }
    this.ws = null;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onDispatch(handler: DispatchHandler): () => void {
    this.dispatchHandlers.add(handler);
    return () => {
      this.dispatchHandlers.delete(handler);
    };
  }

  private async fetchGatewayUrl(): Promise<string> {
    try {
      const res = await fetch("https://discord.com/api/v10/gateway/bot", {
        headers: { Authorization: `Bot ${this.config.token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { url?: string };
        if (body.url) {
          return `${body.url}?v=10&encoding=json`;
        }
      }
    } catch {
      void 0;
    }
    return DEFAULT_GATEWAY_URL;
  }

  private connect(url: string): void {
    this.clearTimers();
    this.ws = this.createWs(url);

    this.ws.on("open", () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
    });

    this.ws.on("message", (data: Buffer) => {
      const payload: GatewayPayload = JSON.parse(data.toString());
      this.handlePayload(payload);
    });

    this.ws.on("close", () => {
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", () => {
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    });
  }

  private handlePayload(payload: GatewayPayload): void {
    switch (payload.op) {
      case GatewayOP.DISPATCH:
        this.handleDispatch(payload);
        break;
      case GatewayOP.HELLO:
        this.handleHello(payload.d as HelloData);
        break;
      case GatewayOP.HEARTBEAT_ACK:
        break;
      case GatewayOP.RECONNECT:
        this.scheduleReconnect();
        break;
      case GatewayOP.HEARTBEAT:
        this.sendHeartbeat();
        break;
    }
  }

  private handleDispatch(payload: GatewayPayload): void {
    if (payload.s != null) {
      this.sequence = payload.s;
    }

    const type = payload.t;
    if (type === "READY") {
      const d = payload.d as { session_id?: string; resume_gateway_url?: string };
      if (d.session_id) {
        this.sessionId = d.session_id;
      }
      if (d.resume_gateway_url) {
        this.resumeUrl = `${d.resume_gateway_url}?v=10&encoding=json`;
      }
    }

    if (type === "MESSAGE_CREATE") {
      const raw = payload.d as DiscordRawMessage;
      if (raw.author?.bot) return;
      const msg = this.mapMessage(raw);
      for (const handler of this.messageHandlers) {
        handler(msg);
      }
    }

    for (const handler of this.dispatchHandlers) {
      handler({ type: type ?? "", data: payload.d });
    }
  }

  private handleHello(data: HelloData): void {
    this.startHeartbeat(data.heartbeat_interval);
    if (this.sessionId && this.sequence != null) {
      this.sendResume();
    } else {
      this.sendIdentify();
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat(): void {
    this.send({ op: GatewayOP.HEARTBEAT, d: this.sequence });
  }

  private sendIdentify(): void {
    const data: IdentifyData = {
      token: this.config.token,
      properties: {
        os: process.platform,
        browser: "openhawkins",
        device: "openhawkins",
      },
      intents: INTENTS,
    };
    this.send({ op: GatewayOP.IDENTIFY, d: data });
  }

  private sendResume(): void {
    const data: ResumeData = {
      token: this.config.token,
      session_id: this.sessionId!,
      seq: this.sequence!,
    };
    this.send({ op: GatewayOP.RESUME, d: data });
  }

  private send(payload: GatewayPayload): void {
    if (this.ws && this.ws.readyState !== CLOSED) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        void 0;
      }
      this.ws = null;
    }
    if (this.stopped) {
      this.reconnecting = false;
      return;
    }

    const jitter = this.backoffMs * JITTER_FACTOR * (Math.random() * 2 - 1);
    const delay = this.backoffMs + jitter;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);

    this.reconnectTimer = setTimeout(() => {
      if (!this.stopped) {
        this.reconnectSync();
      }
    }, delay);
    this.reconnecting = false;
  }

  private reconnectSync(): void {
    const url = this.gatewayUrl ?? this.resumeUrl ?? DEFAULT_GATEWAY_URL;
    this.connect(url);
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private mapMessage(raw: DiscordRawMessage): DiscordMessage {
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
