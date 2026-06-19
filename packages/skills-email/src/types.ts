import { z } from "zod";

export interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  unreadCount?: number;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  inline: boolean;
}

export interface EmailMessage {
  id: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  subject: string;
  body: string;
  htmlBody?: string;
  date: string;
  attachments: EmailAttachment[];
  folder: string;
  flags: string[];
}

export interface EmailDraft {
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
  }>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  sort?: "date" | "subject" | "from";
  order?: "asc" | "desc";
  unreadOnly?: boolean;
}

export interface EmailConfig {
  gmail?: {
    imap: string;
    smtp: string;
    imapPort?: number;
    smtpPort?: number;
  };
  graph?: {
    clientId: string;
    tenant: string;
  };
  timeout?: number;
  maxAttachmentSize?: number;
}

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface EmailToolClients {
  gmail?:
    | {
        listFolders(): Promise<EmailFolder[]>;
        listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
        getMessage(id: string): Promise<EmailMessage>;
        send(draft: EmailDraft): Promise<string>;
        search(query: string): Promise<EmailMessage[]>;
      }
    | undefined;
  graph?:
    | {
        listFolders(): Promise<EmailFolder[]>;
        listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
        getMessage(id: string): Promise<EmailMessage>;
        send(draft: EmailDraft): Promise<string>;
        search(query: string): Promise<EmailMessage[]>;
        startDeviceCodeAuth(): Promise<DeviceCodeInfo>;
        waitForAuth(deviceCode: string): Promise<AuthResult>;
        refreshToken(): Promise<AuthResult>;
      }
    | undefined;
}

export const EmailFolderSchema = z.object({
  name: z.string(),
  path: z.string(),
  delimiter: z.string(),
  unreadCount: z.number().optional(),
});

export const EmailAttachmentSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  contentId: z.string().optional(),
  inline: z.boolean(),
});

export const EmailMessageSchema = z.object({
  id: z.string(),
  from: z.object({ name: z.string(), address: z.string() }),
  to: z.array(z.object({ name: z.string(), address: z.string() })),
  cc: z.array(z.object({ name: z.string(), address: z.string() })),
  subject: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
  date: z.string(),
  attachments: z.array(EmailAttachmentSchema),
  folder: z.string(),
  flags: z.array(z.string()),
});

export const EmailDraftSchema = z.object({
  to: z.array(z.object({ name: z.string().optional(), address: z.string() })),
  cc: z.array(z.object({ name: z.string().optional(), address: z.string() })).optional(),
  subject: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.instanceof(Uint8Array),
      }),
    )
    .optional(),
});

export const ListOptionsSchema = z.object({
  limit: z.number().default(20),
  offset: z.number().default(0),
  sort: z.enum(["date", "subject", "from"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  unreadOnly: z.boolean().default(false),
});
