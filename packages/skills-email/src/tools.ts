import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "@openjarvis/core";
import type { EmailToolClients, EmailDraft, ListOptions } from "./types.js";
import { EmailMessageSchema } from "./types.js";

const SearchArgsSchema = z.object({
  provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
  query: z.string(),
  folder: z.string().optional().default("INBOX"),
  limit: z.number().optional().default(20),
});

const SearchResultSchema = z.object({
  messages: z.array(EmailMessageSchema),
  total: z.number(),
});

type SearchArgs = z.infer<typeof SearchArgsSchema>;
type SearchResult = z.infer<typeof SearchResultSchema>;

export function createEmailSearchTool(
  clients: EmailToolClients,
): ToolDefinition<SearchArgs, SearchResult> {
  return {
    name: "email_search",
    description: "Search email messages by query string",
    args: SearchArgsSchema as unknown as z.ZodType<SearchArgs>,
    result: SearchResultSchema as unknown as z.ZodType<SearchResult>,
    capabilities: [{ name: "email:read" as const }],
    handler: async (args) => {
      const client = args.provider === "graph" ? clients.graph : clients.gmail;
      if (!client) {
        throw new Error(`${args.provider} provider not configured`);
      }
      const messages = await client.search(args.query);
      return { messages: messages.slice(0, args.limit), total: messages.length };
    },
  };
}

const ReadArgsSchema = z.object({
  provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
  messageId: z.string().optional(),
  folder: z.string().optional().default("INBOX"),
  limit: z.number().optional().default(20),
});

const ReadResultSchema = z.object({
  message: EmailMessageSchema.optional(),
  messages: z.array(EmailMessageSchema).optional(),
});

type ReadArgs = z.infer<typeof ReadArgsSchema>;
type ReadResult = z.infer<typeof ReadResultSchema>;

export function createEmailReadTool(
  clients: EmailToolClients,
): ToolDefinition<ReadArgs, ReadResult> {
  return {
    name: "email_read",
    description: "Read a single email message or list messages in a folder",
    args: ReadArgsSchema as unknown as z.ZodType<ReadArgs>,
    result: ReadResultSchema as unknown as z.ZodType<ReadResult>,
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
      const opts: ListOptions = {};
      if (args.limit !== undefined) {
        opts.limit = args.limit;
      }
      const messages = await client.listMessages(args.folder, opts);
      return { messages };
    },
  };
}

const DraftArgsSchema = z.object({
  provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
  to: z.array(z.object({ name: z.string().optional(), address: z.string() })),
  cc: z.array(z.object({ name: z.string().optional(), address: z.string() })).optional(),
  subject: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
});

const DraftResultSchema = z.object({
  draftId: z.string(),
  preview: z.object({
    to: z.array(z.any()),
    subject: z.string(),
    bodyPreview: z.string(),
  }),
});

type DraftArgs = z.infer<typeof DraftArgsSchema>;
type DraftResult = z.infer<typeof DraftResultSchema>;

export function createEmailDraftTool(
  clients: EmailToolClients,
): ToolDefinition<DraftArgs, DraftResult> {
  void clients;
  return {
    name: "email_draft",
    description: "Create an email draft preview without sending",
    args: DraftArgsSchema as unknown as z.ZodType<DraftArgs>,
    result: DraftResultSchema as unknown as z.ZodType<DraftResult>,
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

const SendArgsSchema = z.object({
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
});

const SendResultSchema = z.object({ messageId: z.string() });

type SendArgs = z.infer<typeof SendArgsSchema>;
type SendResult = z.infer<typeof SendResultSchema>;

export function createEmailSendTool(
  clients: EmailToolClients,
): ToolDefinition<SendArgs, SendResult> {
  return {
    name: "email_send",
    description: "Send an email message",
    args: SendArgsSchema as unknown as z.ZodType<SendArgs>,
    result: SendResultSchema as unknown as z.ZodType<SendResult>,
    capabilities: [{ name: "email:send" as const }],
    handler: async (args) => {
      const client = args.provider === "graph" ? clients.graph : clients.gmail;
      if (!client) {
        throw new Error(`${args.provider} provider not configured`);
      }
      const draft: EmailDraft = {
        to: args.to.map((r) => ({ ...(r.name != null && { name: r.name }), address: r.address })),
        ...(args.cc != null && { cc: args.cc.map((r) => ({ ...(r.name != null && { name: r.name }), address: r.address })) }),
        subject: args.subject,
        body: args.body,
        ...(args.htmlBody != null && { htmlBody: args.htmlBody }),
        ...(args.attachments != null && { attachments: args.attachments }),
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