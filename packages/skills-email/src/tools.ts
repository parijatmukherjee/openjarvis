import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "@openjarvis/core";
import type { ToolRegistry } from "@openjarvis/core";
import type { EmailToolClients, EmailDraft } from "./types.js";
import { EmailMessageSchema } from "./types.js";

export function createEmailSearchTool(
  clients: EmailToolClients,
): ToolDefinition<{ provider: string; query: string; folder?: string; limit?: number }, { messages: unknown[]; total: number }> {
  return {
    name: "email_search",
    description: "Search email messages by query string",
    args: z.object({
      provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
      query: z.string(),
      folder: z.string().optional().default("INBOX"),
      limit: z.number().optional().default(20),
    }),
    result: z.object({
      messages: z.array(EmailMessageSchema),
      total: z.number(),
    }),
    capabilities: [{ name: "email:read" as const }],
    handler: async (args) => {
      const client = args.provider === "graph" ? clients.graph : clients.gmail;
      if (!client) {
        throw new Error(`${args.provider} provider not configured`);
      }
      const messages = await client.search(args.query);
      return { messages: messages.slice(0, args.limit ?? 20), total: messages.length };
    },
  };
}

export function createEmailReadTool(
  clients: EmailToolClients,
): ToolDefinition<{ provider: string; messageId?: string; folder?: string; limit?: number }, { message?: unknown; messages?: unknown[] }> {
  return {
    name: "email_read",
    description: "Read a single email message or list messages in a folder",
    args: z.object({
      provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
      messageId: z.string().optional(),
      folder: z.string().optional().default("INBOX"),
      limit: z.number().optional().default(20),
    }),
    result: z.object({
      message: EmailMessageSchema.optional(),
      messages: z.array(EmailMessageSchema).optional(),
    }),
    capabilities: [{ name: "email:read" as const }],
    handler: async (args) => {
      const client = args.provider === "graph" ? clients.graph : clients.gmail;
      if (!client) {
        throw new Error(`${args.provider} provider not configured`);
      }
      if (args.messageId) {
        const message = await client.getMessage(args.messageId);
        return { message };
      }
      const messages = await client.listMessages(args.folder ?? "INBOX", { limit: args.limit });
      return { messages };
    },
  };
}

export function createEmailDraftTool(
  clients: EmailToolClients,
): ToolDefinition<{ provider: string; to: unknown[]; cc?: unknown[]; subject: string; body: string; htmlBody?: string }, { draftId: string; preview: unknown }> {
  return {
    name: "email_draft",
    description: "Create an email draft preview without sending",
    args: z.object({
      provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
      to: z.array(z.object({ name: z.string().optional(), address: z.string() })),
      cc: z.array(z.object({ name: z.string().optional(), address: z.string() })).optional(),
      subject: z.string(),
      body: z.string(),
      htmlBody: z.string().optional(),
    }),
    result: z.object({
      draftId: z.string(),
      preview: z.object({
        to: z.array(z.any()),
        subject: z.string(),
        bodyPreview: z.string(),
      }),
    }),
    capabilities: [{ name: "email:send" as const }],
    handler: async (args) => {
      const draftId = randomUUID();
      return {
        draftId,
        preview: {
          to: args.to,
          subject: args.subject,
          bodyPreview: args.body.slice(0, 200),
        },
      };
    },
  };
}

export function createEmailSendTool(
  clients: EmailToolClients,
): ToolDefinition<{ provider: string; to: unknown[]; cc?: unknown[]; subject: string; body: string; htmlBody?: string; attachments?: unknown[] }, { messageId: string }> {
  return {
    name: "email_send",
    description: "Send an email message",
    args: z.object({
      provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
      to: z.array(z.object({ name: z.string().optional(), address: z.string() })),
      cc: z.array(z.object({ name: z.string().optional(), address: z.string() })).optional(),
      subject: z.string(),
      body: z.string(),
      htmlBody: z.string().optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.instanceof(Uint8Array),
      })).optional(),
    }),
    result: z.object({ messageId: z.string() }),
    capabilities: [{ name: "email:send" as const }],
    handler: async (args) => {
      const client = args.provider === "graph" ? clients.graph : clients.gmail;
      if (!client) {
        throw new Error(`${args.provider} provider not configured`);
      }
      const draft: EmailDraft = {
        to: args.to as Array<{ name?: string; address: string }>,
        cc: args.cc as Array<{ name?: string; address: string }> | undefined,
        subject: args.subject,
        body: args.body,
        htmlBody: args.htmlBody,
        attachments: args.attachments as Array<{ filename: string; contentType: string; content: Uint8Array }> | undefined,
      };
      const messageId = await client.send(draft);
      return { messageId };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerEmailTools(
  registry: { register(tool: AnyToolDefinition): void },
  clients: EmailToolClients,
): void {
  registry.register(createEmailSearchTool(clients));
  registry.register(createEmailReadTool(clients));
  registry.register(createEmailDraftTool(clients));
  registry.register(createEmailSendTool(clients));
}