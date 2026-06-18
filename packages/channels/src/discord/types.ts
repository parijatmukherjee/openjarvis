export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  authorUsername: string;
  content: string;
  timestamp: number;
  editedTimestamp: number | null;
  attachments: DiscordAttachment[];
}

export interface DiscordAttachment {
  id: string;
  url: string;
  filename: string;
  contentType: string | null;
  size: number;
}

export interface DiscordChannelInfo {
  id: string;
  name: string;
  guildId: string | null;
  type: "text" | "dm" | "thread";
}

export enum GatewayOP {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  RESUME = 6,
  RECONNECT = 7,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
}

export interface GatewayPayload {
  op: GatewayOP;
  t?: string;
  d?: unknown;
  s?: number;
}

export interface HelloData {
  heartbeat_interval: number;
}

export interface IdentifyData {
  token: string;
  properties: {
    os: string;
    browser: string;
    device: string;
  };
  intents: number;
}

export interface ResumeData {
  token: string;
  session_id: string;
  seq: number;
}

export interface DiscordRawMessage {
  id: string;
  channel_id: string;
  guild_id?: string | null;
  author: {
    id: string;
    username: string;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  attachments: Array<{
    id: string;
    url: string;
    filename: string;
    content_type?: string | null;
    size: number;
  }>;
}

export interface GatewayDispatchEvent {
  type: string;
  data: unknown;
}

export interface DiscordGatewayEvents {
  dispatch: GatewayDispatchEvent;
  message: DiscordMessage;
}