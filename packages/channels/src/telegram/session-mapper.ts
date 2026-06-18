const DM_PREFIX = "telegram:dm:";
const GROUP_PREFIX = "telegram:group:";

export class TelegramSessionMapper {
  private sessions = new Map<number, string>();

  getOrCreateSession(chatId: number, chatType: string): string {
    const existing = this.sessions.get(chatId);
    if (existing) return existing;

    const sessionId =
      chatType === "private" || chatType === "channel"
        ? `${DM_PREFIX}${chatId}`
        : `${GROUP_PREFIX}${chatId}`;
    this.sessions.set(chatId, sessionId);
    return sessionId;
  }

  getSession(chatId: number): string | undefined {
    return this.sessions.get(chatId);
  }

  removeSession(chatId: number): void {
    this.sessions.delete(chatId);
  }
}