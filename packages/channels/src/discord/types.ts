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
