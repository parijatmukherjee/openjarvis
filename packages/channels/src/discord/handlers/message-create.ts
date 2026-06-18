import type { DiscordMessage, DiscordMessageCreatePayload } from "../types.js";

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function validateMessageCreate(d: unknown): DiscordMessageCreatePayload {
  if (!isObject(d)) throw new Error("Invalid MESSAGE_CREATE payload");
  if (typeof d.id !== "string") throw new Error("Missing id");
  if (typeof d.channel_id !== "string") throw new Error("Missing channel_id");
  if (!isObject(d.author)) throw new Error("Missing author");
  if (typeof d.author.id !== "string") throw new Error("Missing author.id");
  if (typeof d.author.username !== "string") throw new Error("Missing author.username");
  if (typeof d.content !== "string") throw new Error("Missing content");
  if (typeof d.timestamp !== "string") throw new Error("Missing timestamp");
  return d as unknown as DiscordMessageCreatePayload;
}

export function mapMessageCreate(d: unknown): DiscordMessage {
  const p = validateMessageCreate(d);
  return {
    id: p.id,
    channelId: p.channel_id,
    guildId: p.guild_id ?? null,
    authorId: p.author.id,
    authorUsername: p.author.username,
    content: p.content,
    timestamp: new Date(p.timestamp).getTime(),
    editedTimestamp: p.edited_timestamp ? new Date(p.edited_timestamp).getTime() : null,
    attachments: (p.attachments ?? []).map((a) => ({
      id: a.id,
      url: a.url,
      filename: a.filename,
      contentType: a.content_type ?? null,
      size: a.size,
    })),
  };
}
