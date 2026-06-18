import type { DiscordInteractionCreatePayload } from "../types.js";

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function validateInteractionCreate(d: unknown): DiscordInteractionCreatePayload {
  if (!isObject(d)) throw new Error("Invalid INTERACTION_CREATE payload");
  if (typeof d.id !== "string") throw new Error("Missing id");
  if (typeof d.type !== "number") throw new Error("Missing type");
  return d as unknown as DiscordInteractionCreatePayload;
}

export function mapInteractionCreate(d: unknown): {
  id: string;
  type: number;
  name: string;
  data?: Record<string, unknown>;
} {
  const p = validateInteractionCreate(d);
  return {
    id: p.id,
    type: p.type,
    name: p.data?.name ?? "",
    ...(p.data ? { data: p.data as Record<string, unknown> } : {}),
  };
}