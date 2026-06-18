export interface TelegramMessage {
  id: number;
  chatId: number;
  chatType: "private" | "group" | "supergroup" | "channel";
  fromId: number;
  fromUsername: string;
  text: string;
  timestamp: number;
}

export interface TelegramChatInfo {
  id: number;
  type: string;
  title: string | null;
  username: string | null;
}

export interface TelegramBotConfig {
  token: string;
}