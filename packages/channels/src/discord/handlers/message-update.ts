import type { DiscordMessage, DiscordMessageUpdatePayload } from "../types.js";

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function validateMessageUpdate(d: unknown): DiscordMessageUpdatePayload {
  if (!isObject(d)) throw new Error("Invalid MESSAGE_UPDATE payload");
  if (typeof d.id !== "string") throw new Error("Missing id");
  return d as unknown as DiscordMessageUpdatePayload;
}

export function mapMessageUpdate(d: unknown): DiscordMessage {
  const p = validateMessageUpdate(d);
  const author = p.author ?? { id: "", username: "" };
  return {
    id: p.id,
    channelId: p.channel_id ?? "",
    guildId: p.guild_id ?? null,
    authorId: author.id,
    authorUsername: author.username,
    content: p.content ?? "",
    timestamp: p.timestamp ? new Date(p.timestamp).getTime() : 0,
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
