import type { DiscordReactionAddPayload } from "../types.js";

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function validateReactionAdd(d: unknown): DiscordReactionAddPayload {
  if (!isObject(d)) throw new Error("Invalid REACTION_ADD payload");
  if (typeof d.user_id !== "string") throw new Error("Missing user_id");
  if (typeof d.channel_id !== "string") throw new Error("Missing channel_id");
  if (typeof d.message_id !== "string") throw new Error("Missing message_id");
  if (!isObject(d.emoji)) throw new Error("Missing emoji");
  return d as unknown as DiscordReactionAddPayload;
}

export function mapReactionAdd(d: unknown): {
  messageId: string;
  channelId: string;
  emoji: string;
  userId: string;
} {
  const p = validateReactionAdd(d);
  const emoji = p.emoji.name ?? p.emoji.id ?? "";
  return {
    messageId: p.message_id,
    channelId: p.channel_id,
    emoji,
    userId: p.user_id,
  };
}
