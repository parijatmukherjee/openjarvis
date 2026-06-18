import type { DiscordMessageDeletePayload } from "../types.js";

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function validateMessageDelete(d: unknown): DiscordMessageDeletePayload {
  if (!isObject(d)) throw new Error("Invalid MESSAGE_DELETE payload");
  if (typeof d.id !== "string") throw new Error("Missing id");
  if (typeof d.channel_id !== "string") throw new Error("Missing channel_id");
  return d as unknown as DiscordMessageDeletePayload;
}

export function mapMessageDelete(d: unknown): { id: string; channelId: string } {
  const p = validateMessageDelete(d);
  return { id: p.id, channelId: p.channel_id };
}
