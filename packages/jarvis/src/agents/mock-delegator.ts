import type { Delegator, AgentResult } from "./delegator.js";
import type { Intent } from "../intent.js";
import type { JarvisContext } from "../context.js";

/**
 * Mock delegator for v1. Instead of spawning real agents, it returns
 * deterministic mock results based on the intent action.
 *
 * v1.1: Replace with real agent pool + process spawning.
 */
export class MockDelegator implements Delegator {
  async delegate(intent: Intent, _context: JarvisContext): Promise<AgentResult[]> {
    switch (intent.action) {
      case "open_app": {
        const app = String(intent.params.app || "unknown");
        return [
          {
            agentId: "system-agent",
            agentName: "System Agent",
            output: { opened: app },
            success: true,
            auditEntry: {
              kind: "ToolReturned",
              at: Date.now(),
              data: { tool: "open_app", ok: true },
            },
          },
        ];
      }

      case "search": {
        const query = String(intent.params.query || "");
        return [
          {
            agentId: "research-agent",
            agentName: "Research Agent",
            output: { results: [`Results for "${query}"`] },
            success: true,
            auditEntry: {
              kind: "ToolReturned",
              at: Date.now(),
              data: { tool: "search", ok: true },
            },
          },
        ];
      }

      case "get_calendar":
        return [
          {
            agentId: "system-agent",
            agentName: "System Agent",
            output: { events: ["10:00 Standup", "14:00 Review"] },
            success: true,
            auditEntry: {
              kind: "ToolReturned",
              at: Date.now(),
              data: { tool: "calendar", ok: true },
            },
          },
        ];

      case "set_reminder": {
        const text = String(intent.params.text || "");
        return [
          {
            agentId: "system-agent",
            agentName: "System Agent",
            output: { reminder: text },
            success: true,
            auditEntry: {
              kind: "ToolReturned",
              at: Date.now(),
              data: { tool: "reminder", ok: true },
            },
          },
        ];
      }

      case "vision_query":
        return [
          {
            agentId: "vision-agent",
            agentName: "Vision Agent",
            output: { seen: "a person standing near the desk" },
            success: true,
            auditEntry: {
              kind: "ToolReturned",
              at: Date.now(),
              data: { tool: "vision", ok: true },
            },
          },
        ];

      case "unknown":
      default:
        return [];
    }
  }
}
