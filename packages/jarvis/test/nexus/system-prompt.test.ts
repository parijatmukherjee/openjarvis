import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  JARVIS_PERSONA,
  SYSTEM_PROMPT_MAX_CHARS,
  type SystemPromptRole,
} from "../../src/nexus/system-prompt.js";
import type { JarvisContext } from "../../src/nexus/types.js";

const baseContext: JarvisContext = {
  sessionId: "s1",
  userId: "desktop-user",
  recentIntents: [],
  currentTime: new Date("2026-06-20T12:00:00Z"),
};

describe("buildSystemPrompt", () => {
  it("includes persona, user id, and role tail", () => {
    const prompt = buildSystemPrompt("router", baseContext);
    expect(prompt).toContain(JARVIS_PERSONA);
    expect(prompt).toContain("User: desktop-user");
    expect(prompt.toLowerCase()).toContain("classifier");
  });

  it("omits the Recent actions line when recentIntents is empty", () => {
    const prompt = buildSystemPrompt("general", baseContext);
    expect(prompt).not.toContain("Recent actions:");
  });

  it("includes the last 3 intent actions when present", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: [
        { action: "check_weather", params: {}, confidence: 1, ambiguous: false },
        { action: "search", params: {}, confidence: 1, ambiguous: false },
        { action: "chat", params: {}, confidence: 1, ambiguous: false },
        { action: "send_email", params: {}, confidence: 1, ambiguous: false },
      ],
    };
    const prompt = buildSystemPrompt("synthesizer", ctx);
    expect(prompt).toContain("Recent actions: send_email, chat, search");
  });

  it("role-specific tail differs across roles", () => {
    const routerPrompt = buildSystemPrompt("router", baseContext);
    const generalPrompt = buildSystemPrompt("general", baseContext);
    const synthPrompt = buildSystemPrompt("synthesizer", baseContext);
    expect(routerPrompt).not.toBe(generalPrompt);
    expect(generalPrompt).not.toBe(synthPrompt);
    expect(routerPrompt).not.toBe(synthPrompt);
  });

  it("truncates with … when total exceeds SYSTEM_PROMPT_MAX_CHARS", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: Array.from({ length: 3 }, (_, i) => ({
        action: `action_with_a_long_name_${i}_`.repeat(50),
        params: {},
        confidence: 1,
        ambiguous: false,
      })),
    };
    const prompt = buildSystemPrompt("general", ctx);
    expect(prompt.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    expect(prompt.endsWith("…")).toBe(true);
  });

  it("returns a non-empty prompt even with minimal context", () => {
    const prompt = buildSystemPrompt("router", baseContext);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("does not exceed SYSTEM_PROMPT_MAX_CHARS even with normal inputs", () => {
    const ctx: JarvisContext = {
      ...baseContext,
      recentIntents: [
        { action: "check_weather", params: {}, confidence: 1, ambiguous: false },
        { action: "search", params: {}, confidence: 1, ambiguous: false },
      ],
    };
    for (const role of ["router", "general", "synthesizer"] as SystemPromptRole[]) {
      const prompt = buildSystemPrompt(role, ctx);
      expect(prompt.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    }
  });
});
