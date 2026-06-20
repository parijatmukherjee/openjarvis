import type { JarvisContext } from "./types.js";

export type SystemPromptRole = "router" | "general" | "synthesizer";

export const JARVIS_PERSONA = `You are JARVIS (Just A Rather Very Intelligent System), a concise, helpful AI assistant. Speak with dry British wit. Prefer short, direct answers. Avoid hedging. If you don't know, say so.`;

const ROLE_TAILS: Record<SystemPromptRole, string> = {
  router:
    "You are an intent classifier. Respond with JSON: { action: '<action>', confidence: <0.0-1.0> }. Valid actions follow.",
  general: "Respond concisely to the user's question.",
  synthesizer:
    "Synthesize the following agent results into a concise, natural response for the user. Do not mention agent IDs or internal details.",
};

export const SYSTEM_PROMPT_MAX_CHARS = 1500;

export function buildSystemPrompt(role: SystemPromptRole, context: JarvisContext): string {
  const user = `User: ${context.userId}`;
  const recentActions = context.recentIntents
    .slice(-3)
    .reverse()
    .map((i) => i.action)
    .filter((a): a is string => typeof a === "string" && a.length > 0);
  const recent = recentActions.length > 0 ? `Recent actions: ${recentActions.join(", ")}` : "";
  const tail = ROLE_TAILS[role];
  const parts = [JARVIS_PERSONA, user, recent, tail].filter(Boolean);
  const joined = parts.join("\n\n");
  if (joined.length <= SYSTEM_PROMPT_MAX_CHARS) return joined;
  return joined.slice(0, SYSTEM_PROMPT_MAX_CHARS - 1) + "…";
}
