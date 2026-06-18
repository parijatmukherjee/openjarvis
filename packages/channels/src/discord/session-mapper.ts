const DISCORD_PREFIX = "discord:";
const DM_PREFIX = "discord:dm:";

export class DiscordSessionMapper {
  constructor(private readonly guildId: string) {}

  channelToSession(channelId: string): string {
    return `${DISCORD_PREFIX}${this.guildId}:${channelId}`;
  }

  dmToSession(userId: string): string {
    return `${DM_PREFIX}${userId}`;
  }

  sessionToChannel(sessionId: string): string | null {
    if (!sessionId.startsWith(DISCORD_PREFIX) || sessionId.startsWith(DM_PREFIX)) return null;
    const parts = sessionId.split(":");
    if (parts.length < 3) return null;
    return parts.slice(2).join(":");
  }

  sessionToDmUser(sessionId: string): string | null {
    if (!sessionId.startsWith(DM_PREFIX)) return null;
    return sessionId.slice(DM_PREFIX.length);
  }

  isDiscordSession(sessionId: string): boolean {
    return sessionId.startsWith(DISCORD_PREFIX);
  }
}
