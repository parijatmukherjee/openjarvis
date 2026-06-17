# Email Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@openjarvis/skills-email` with Gmail (IMAP/SMTP) and Microsoft Graph (OAuth2 device code) providers behind a unified `EmailClient` interface, with 4 capability-gated tools.

**Architecture:** Two provider implementations (`GmailClient` using node-imap + nodemailer, `GraphClient` using Microsoft Graph REST API + OAuth2 device code flow) behind a unified `EmailToolClients` interface. Tools follow the established `ToolDefinition` pattern with Zod schemas and capability gates. Tokens/credentials stored in existing `Vault`.

**Tech Stack:** node-imap, mailparser, nodemailer, @openjarvis/core (ToolRegistry, Vault, capabilities), vitest, nock

---

## Task 1: Scaffold package and add capabilities

**Files:**
- Create: `packages/skills-email/package.json`
- Create: `packages/skills-email/tsconfig.json`
- Create: `packages/skills-email/vitest.config.ts`
- Create: `packages/skills-email/src/index.ts`
- Modify: `packages/core/src/security/capability.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@openjarvis/skills-email",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "@openjarvis/core": "*",
    "imapflow": "^1.0.0",
    "mailparser": "^3.7.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/nodemailer": "^6.4.0",
    "nock": "^14.0.0",
    "vitest": "^3.0.0"
  }
}
```

Note: Using `imapflow` instead of `node-imap` because `node-imap` has no type declarations and is unmaintained; `imapflow` is the modern TypeScript successor by the same author with a cleaner async API.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create empty src/index.ts**

```ts
export type { EmailClient, EmailFolder, EmailMessage, EmailAttachment, EmailDraft, ListOptions, EmailConfig, EmailToolClients, DeviceCodeInfo, AuthResult } from "./types.js";
export { GmailEmailClient } from "./gmail/client.js";
export { GraphEmailClient } from "./graph/graph-client.js";
export { registerEmailTools } from "./tools.js";
```

- [ ] **Step 5: Add email capabilities to CapabilityName union**

In `packages/core/src/security/capability.ts`, add `"email:read"` and `"email:send"` to the `CapabilityName` type union:

```ts
export type CapabilityName =
  | "shell"
  | "network"
  | "fs:read"
  | "fs:write"
  | "host:info"
  | "model-call"
  | "playbook:override"
  | "document:convert"
  | "discord:message"
  | "discord:read"
  | "web:fetch"
  | "web:browse"
  | "email:read"
  | "email:send";
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `cd packages/skills-email && npm install && cd ../.. && npx tsc -b packages/skills-email`

Expected: Clean install with no type errors. The index.ts re-exports will fail until types exist — that's expected and resolved in Task 2.

- [ ] **Step 7: Commit**

```bash
git add packages/skills-email/ packages/core/src/security/capability.ts
git commit -m "feat(email): scaffold skills-email package and add email capabilities"
```

---

## Task 2: Types and interfaces

**Files:**
- Create: `packages/skills-email/src/types.ts`
- Test: `packages/skills-email/test/types.test.ts`

- [ ] **Step 1: Write the failing test for types**

Create `packages/skills-email/test/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  EmailFolderSchema,
  EmailAttachmentSchema,
  EmailMessageSchema,
  EmailDraftSchema,
  ListOptionsSchema,
} from "../src/types.js";

describe("EmailFolderSchema", () => {
  it("parses a valid folder", () => {
    const result = EmailFolderSchema.safeParse({
      name: "INBOX",
      path: "INBOX",
      delimiter: ".",
    });
    expect(result.success).toBe(true);
  });

  it("defaults unreadCount to undefined", () => {
    const result = EmailFolderSchema.safeParse({
      name: "INBOX",
      path: "INBOX",
      delimiter: ".",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unreadCount).toBeUndefined();
    }
  });
});

describe("EmailAttachmentSchema", () => {
  it("parses an attachment with required fields", () => {
    const result = EmailAttachmentSchema.safeParse({
      filename: "doc.pdf",
      contentType: "application/pdf",
      size: 2048,
      inline: false,
    });
    expect(result.success).toBe(true);
  });

  it("defaults contentId to undefined", () => {
    const result = EmailAttachmentSchema.safeParse({
      filename: "doc.pdf",
      contentType: "application/pdf",
      size: 2048,
      inline: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentId).toBeUndefined();
    }
  });
});

describe("EmailMessageSchema", () => {
  it("parses a valid message", () => {
    const result = EmailMessageSchema.safeParse({
      id: "msg1",
      from: { name: "Alice", address: "alice@example.com" },
      to: [{ name: "Bob", address: "bob@example.com" }],
      cc: [],
      subject: "Hello",
      body: "Hi there",
      date: "2026-06-17T00:00:00.000Z",
      attachments: [],
      folder: "INBOX",
      flags: ["\\Seen"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults htmlBody to undefined", () => {
    const result = EmailMessageSchema.safeParse({
      id: "msg1",
      from: { name: "Alice", address: "alice@example.com" },
      to: [{ name: "Bob", address: "bob@example.com" }],
      cc: [],
      subject: "Hello",
      body: "Hi",
      date: "2026-06-17T00:00:00.000Z",
      attachments: [],
      folder: "INBOX",
      flags: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.htmlBody).toBeUndefined();
    }
  });
});

describe("EmailDraftSchema", () => {
  it("parses a draft with required fields", () => {
    const result = EmailDraftSchema.safeParse({
      to: [{ address: "bob@example.com" }],
      subject: "Test",
      body: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("makes cc, htmlBody, and attachments optional", () => {
    const result = EmailDraftSchema.safeParse({
      to: [{ address: "bob@example.com" }],
      subject: "Test",
      body: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cc).toBeUndefined();
      expect(result.data.htmlBody).toBeUndefined();
      expect(result.data.attachments).toBeUndefined();
    }
  });
});

describe("ListOptionsSchema", () => {
  it("applies defaults for limit, offset, sort, order", () => {
    const result = ListOptionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.sort).toBe("date");
      expect(result.data.order).toBe("desc");
      expect(result.data.unreadOnly).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/skills-email && npx vitest run test/types.test.ts`

Expected: FAIL — module `../src/types.js` not found.

- [ ] **Step 3: Write the types module**

Create `packages/skills-email/src/types.ts`:

```ts
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
  gmail?: {
    listFolders(): Promise<EmailFolder[]>;
    listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
    getMessage(id: string): Promise<EmailMessage>;
    send(draft: EmailDraft): Promise<string>;
    search(query: string): Promise<EmailMessage[]>;
  };
  graph?: {
    listFolders(): Promise<EmailFolder[]>;
    listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
    getMessage(id: string): Promise<EmailMessage>;
    send(draft: EmailDraft): Promise<string>;
    search(query: string): Promise<EmailMessage[]>;
    startDeviceCodeAuth(): Promise<DeviceCodeInfo>;
    waitForAuth(deviceCode: string): Promise<AuthResult>;
    refreshToken(): Promise<AuthResult>;
  };
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
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    content: z.instanceof(Uint8Array),
  })).optional(),
});

export const ListOptionsSchema = z.object({
  limit: z.number().default(20),
  offset: z.number().default(0),
  sort: z.enum(["date", "subject", "from"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  unreadOnly: z.boolean().default(false),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/skills-email && npx vitest run test/types.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-email/src/types.ts packages/skills-email/test/types.test.ts
git commit -m "feat(email): add type definitions and Zod schemas for email integration"
```

---

## Task 3: Gmail IMAP client

**Files:**
- Create: `packages/skills-email/src/gmail/imap-client.ts`
- Test: `packages/skills-email/test/gmail/imap-client.test.ts`

- [ ] **Step 1: Write the failing test for GmailImapClient**

Create `packages/skills-email/test/gmail/imap-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GmailImapClient } from "../../src/gmail/imap-client.js";
import type { ImapClient, ImapFetchMessageOptions } from "imapflow";

function createMockClient(): {
  client: ImapClient;
  impl: Record<string, (...args: unknown[]) => unknown>;
} {
  const impl: Record<string, (...args: unknown[]) => unknown> = {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    listMailboxes: vi.fn().mockResolvedValue([
      { path: "INBOX", name: "INBOX", delimiter: ".", specialUse: "\\Inbox" },
      { path: "Sent", name: "Sent", delimiter: ".", specialUse: "\\Sent" },
    ]),
    fetchAll: vi.fn().mockResolvedValue([]),
    fetchOne: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
    mailboxOpen: vi.fn().mockResolvedValue({ exists: 0 }),
  };

  const client = {
    connect: (...args: unknown[]) => impl.connect(...args),
    logout: (...args: unknown[]) => impl.logout(...args),
    listMailboxes: (...args: unknown[]) => impl.listMailboxes(...args),
    fetchAll: (...args: unknown[]) => impl.fetchAll(...args),
    fetchOne: (...args: unknown[]) => impl.fetchOne(...args),
    search: (...args: unknown[]) => impl.search(...args),
    mailboxOpen: (...args: unknown[]) => impl.mailboxOpen(...args),
  } as unknown as ImapClient;

  return { client, impl };
}

const config = {
  host: "imap.gmail.com",
  port: 993,
  user: "test@gmail.com",
  password: "app-password",
};

describe("GmailImapClient", () => {
  let imapClient: GmailImapClient;

  beforeEach(() => {
    const { client } = createMockClient();
    imapClient = new GmailImapClient(config, client);
  });

  it("listFolders returns mapped EmailFolder array", async () => {
    const { client } = createMockClient();
    const ic = new GmailImapClient(config, client);
    const folders = await ic.listFolders();
    expect(folders).toEqual([
      { name: "INBOX", path: "INBOX", delimiter: ".", unreadCount: undefined },
      { name: "Sent", path: "Sent", delimiter: ".", unreadCount: undefined },
    ]);
  });

  it("listMessages fetches envelopes and maps to EmailMessage", async () => {
    const { client, impl } = createMockClient();
    impl.fetchAll.mockResolvedValue([
      {
        uid: 1,
        envelope: {
          from: { name: "Alice", address: "alice@example.com" },
          to: [{ name: "Bob", address: "bob@example.com" }],
          cc: [],
          subject: "Hello",
          date: new Date("2026-06-17T00:00:00Z"),
          messageId: "msg1@example.com",
        },
        flags: ["\\Seen"],
      },
    ]);
    const ic = new GmailImapClient(config, client);
    const messages = await ic.listMessages("INBOX", { limit: 10 });
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("1");
    expect(messages[0].subject).toBe("Hello");
  });

  it("search delegates to imapflow search and returns messages", async () => {
    const { client, impl } = createMockClient();
    impl.search.mockResolvedValue(["1", "2"]);
    impl.fetchAll.mockResolvedValue([
      {
        uid: 1,
        envelope: {
          from: { name: "Alice", address: "alice@example.com" },
          to: [{ name: "Bob", address: "bob@example.com" }],
          cc: [],
          subject: "Test",
          date: new Date("2026-06-17T00:00:00Z"),
          messageId: "msg1@example.com",
        },
        flags: [],
      },
      {
        uid: 2,
        envelope: {
          from: { name: "Carol", address: "carol@example.com" },
          to: [{ name: "Bob", address: "bob@example.com" }],
          cc: [],
          subject: "Another",
          date: new Date("2026-06-16T00:00:00Z"),
          messageId: "msg2@example.com",
        },
        flags: [],
      },
    ]);
    const ic = new GmailImapClient(config, client);
    const results = await ic.search("from:alice@example.com");
    expect(impl.search).toHaveBeenCalledWith(expect.objectContaining({ from: "alice@example.com" }));
    expect(results).toHaveLength(2);
  });

  it("getMessage fetches a single message by uid", async () => {
    const { client, impl } = createMockClient();
    impl.fetchOne.mockResolvedValue({
      uid: 42,
      envelope: {
        from: { name: "Dave", address: "dave@example.com" },
        to: [{ name: "Eve", address: "eve@example.com" }],
        cc: [],
        subject: "Single",
        date: new Date("2026-06-17T00:00:00Z"),
        messageId: "msg42@example.com",
      },
      flags: ["\\Seen"],
      bodyParts: new Map([["text", "Hello body"]]),
    });
    const ic = new GmailImapClient(config, client);
    const msg = await ic.getMessage("42");
    expect(msg.id).toBe("42");
    expect(msg.subject).toBe("Single");
  });

  it("connects lazily on first operation", async () => {
    const { client, impl } = createMockClient();
    const ic = new GmailImapClient(config, client);
    expect(impl.connect).not.toHaveBeenCalled();
    await ic.listFolders();
    expect(impl.connect).toHaveBeenCalledTimes(1);
    await ic.listFolders();
    expect(impl.connect).toHaveBeenCalledTimes(1);
  });

  it("surfaces errors without throwing", async () => {
    const { client, impl } = createMockClient();
    impl.listMailboxes.mockRejectedValue(new Error("connection lost"));
    const ic = new GmailImapClient(config, client);
    await expect(ic.listFolders()).rejects.toThrow("connection lost");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/skills-email && npx vitest run test/gmail/imap-client.test.ts`

Expected: FAIL — module `../../src/gmail/imap-client.js` not found.

- [ ] **Step 3: Implement GmailImapClient**

Create `packages/skills-email/src/gmail/imap-client.ts`:

```ts
import { ImapClient } from "imapflow";
import type { EmailFolder, EmailMessage, ListOptions } from "../types.js";

export interface GmailImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export class GmailImapClient {
  private connected = false;

  constructor(
    private readonly config: GmailImapConfig,
    private readonly client: ImapClient,
  ) {}

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async listFolders(): Promise<EmailFolder[]> {
    await this.ensureConnected();
    const mailboxes = await this.client.listMailboxes();
    return mailboxes.map((mb) => ({
      name: mb.name,
      path: mb.path,
      delimiter: mb.delimiter,
      unreadCount: undefined,
    }));
  }

  async listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]> {
    await this.ensureConnected();
    await this.client.mailboxOpen(folder);
    const limit = opts?.limit ?? 20;
    const messages = await this.client.fetchAll(
      { uid: true, envelope: true, flags: true },
      { bodies: ["TEXT"] },
    );
    const results: EmailMessage[] = [];
    for (const msg of Array.isArray(messages) ? messages : [messages]) {
      if (results.length >= limit) break;
      results.push(this.mapMessage(msg, folder));
    }
    return results;
  }

  async getMessage(uid: string): Promise<EmailMessage> {
    await this.ensureConnected();
    const msg = await this.client.fetchOne(Number(uid), {
      uid: true,
      envelope: true,
      flags: true,
      bodyParts: true,
    });
    return this.mapMessage(msg, "");
  }

  async search(query: string): Promise<EmailMessage[]> {
    await this.ensureConnected();
    await this.client.mailboxOpen("INBOX");
    const searchCriteria = this.parseSearchQuery(query);
    const uids = await this.client.search(searchCriteria);
    if (uids.length === 0) return [];
    const messages = await this.client.fetchAll(
      { uid: true, envelope: true, flags: true },
      { bodies: ["TEXT"] },
    );
    const results: EmailMessage[] = [];
    for (const msg of Array.isArray(messages) ? messages : [messages]) {
      results.push(this.mapMessage(msg, "INBOX"));
    }
    return results;
  }

  private mapMessage(msg: Record<string, unknown>, folder: string): EmailMessage {
    const envelope = (msg.envelope ?? msg) as Record<string, unknown>;
    const from = (envelope.from ?? { name: "", address: "" }) as { name: string; address: string };
    const to = (Array.isArray(envelope.to) ? envelope.to : []) as Array<{ name: string; address: string }>;
    const cc = (Array.isArray(envelope.cc) ? envelope.cc : []) as Array<{ name: string; address: string }>;
    const bodyParts = msg.bodyParts as Map<string, string> | undefined;
    return {
      id: String(msg.uid ?? ""),
      from,
      to,
      cc,
      subject: String(envelope.subject ?? ""),
      body: bodyParts?.get("text") ?? "",
      htmlBody: bodyParts?.get("html"),
      date: new Date(envelope.date as string ?? Date.now()).toISOString(),
      attachments: [],
      folder,
      flags: Array.isArray(msg.flags) ? (msg.flags as string[]) : [],
    };
  }

  private parseSearchQuery(query: string): Record<string, string | string[]> {
    const criteria: Record<string, string | string[]> = {};
    const parts = query.split(/\s+/);
    for (const part of parts) {
      if (part.startsWith("from:")) {
        criteria.from = part.slice(5);
      } else if (part.startsWith("subject:")) {
        criteria.subject = part.slice(8);
      } else if (part.startsWith("to:")) {
        criteria.to = part.slice(3);
      } else {
        criteria.body = part;
      }
    }
    return criteria;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/skills-email && npx vitest run test/gmail/imap-client.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-email/src/gmail/imap-client.ts packages/skills-email/test/gmail/imap-client.test.ts
git commit -m "feat(email): add GmailImapClient with listFolders, listMessages, getMessage, search"
```

---

## Task 4: Gmail SMTP sender

**Files:**
- Create: `packages/skills-email/src/gmail/smtp-sender.ts`
- Test: `packages/skills-email/test/gmail/smtp-sender.test.ts`

- [ ] **Step 1: Write the failing test for GmailSmtpSender**

Create `packages/skills-email/test/gmail/smtp-sender.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GmailSmtpSender } from "../../src/gmail/smtp-sender.js";
import type { EmailDraft } from "../../src/types.js";

function createMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: "<msg123@gmail.com>" }),
    close: vi.fn(),
  };
}

const config = {
  host: "smtp.gmail.com",
  port: 465,
  user: "test@gmail.com",
  password: "app-password",
};

describe("GmailSmtpSender", () => {
  let sender: GmailSmtpSender;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
    sender = new GmailSmtpSender(config, transport as unknown as ReturnType<typeof import("nodemailer").createTransport>);
  });

  it("sends a simple email and returns the messageId", async () => {
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi Bob",
    };
    const messageId = await sender.send(draft);
    expect(messageId).toBe("msg123@gmail.com");
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "bob@example.com",
      subject: "Hello",
      text: "Hi Bob",
    }));
  });

  it("includes cc addresses when provided", async () => {
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      cc: [{ address: "carol@example.com" }],
      subject: "Hello",
      body: "Hi",
    };
    await sender.send(draft);
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      cc: "carol@example.com",
    }));
  });

  it("sends html body when provided", async () => {
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Plain text",
      htmlBody: "<p>HTML text</p>",
    };
    await sender.send(draft);
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      text: "Plain text",
      html: "<p>HTML text</p>",
    }));
  });

  it("sends attachments when provided", async () => {
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      subject: "Report",
      body: "See attached",
      attachments: [{
        filename: "report.pdf",
        contentType: "application/pdf",
        content: new Uint8Array([1, 2, 3]),
      }],
    };
    await sender.send(draft);
    const call = transport.sendMail.mock.calls[0][0];
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].filename).toBe("report.pdf");
  });

  it("formats recipient names with addresses", async () => {
    const draft: EmailDraft = {
      to: [{ name: "Bob", address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi",
    };
    await sender.send(draft);
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: '"Bob" <bob@example.com>',
    }));
  });

  it("surfaces send errors without throwing", async () => {
    transport.sendMail.mockRejectedValue(new Error("auth failed"));
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi",
    };
    await expect(sender.send(draft)).rejects.toThrow("auth failed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/skills-email && npx vitest run test/gmail/smtp-sender.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GmailSmtpSender**

Create `packages/skills-email/src/gmail/smtp-sender.ts`:

```ts
import type { EmailDraft } from "../types.js";

export interface GmailSmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export class GmailSmtpSender {
  constructor(
    private readonly config: GmailSmtpConfig,
    private readonly transport: { sendMail: (...args: unknown[]) => Promise<{ messageId: string }>; close: () => void },
  ) {}

  async send(draft: EmailDraft): Promise<string> {
    const toAddresses = draft.to.map((r) =>
      r.name ? `"${r.name}" <${r.address}>` : r.address,
    );
    const ccAddresses = draft.cc?.map((r) =>
      r.name ? `"${r.name}" <${r.address}>` : r.address,
    );

    const mailOptions: Record<string, unknown> = {
      from: this.config.user,
      to: toAddresses.join(", "),
      subject: draft.subject,
      text: draft.body,
    };

    if (ccAddresses?.length) {
      mailOptions.cc = ccAddresses.join(", ");
    }
    if (draft.htmlBody) {
      mailOptions.html = draft.htmlBody;
    }
    if (draft.attachments?.length) {
      mailOptions.attachments = draft.attachments.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        content: Buffer.from(a.content),
      }));
    }

    const result = await this.transport.sendMail(mailOptions);
    const messageId = result.messageId.replace(/[<>]/g, "");
    return messageId;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/skills-email && npx vitest run test/gmail/smtp-sender.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-email/src/gmail/smtp-sender.ts packages/skills-email/test/gmail/smtp-sender.test.ts
git commit -m "feat(email): add GmailSmtpSender with send and attachment support"
```

---

## Task 5: Gmail composed client

**Files:**
- Create: `packages/skills-email/src/gmail/client.ts`
- Test: `packages/skills-email/test/gmail/client.test.ts`

- [ ] **Step 1: Write the failing test for GmailEmailClient**

Create `packages/skills-email/test/gmail/client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { GmailEmailClient } from "../../src/gmail/client.js";
import type { GmailImapClient } from "../../src/gmail/imap-client.js";
import type { GmailSmtpSender } from "../../src/gmail/smtp-sender.js";
import type { EmailDraft, EmailFolder, EmailMessage } from "../../src/types.js";

function createMockImap() {
  return {
    listFolders: vi.fn<() => Promise<EmailFolder[]>>().mockResolvedValue([
      { name: "INBOX", path: "INBOX", delimiter: "." },
    ]),
    listMessages: vi.fn<() => Promise<EmailMessage[]>>().mockResolvedValue([]),
    getMessage: vi.fn<() => Promise<EmailMessage>>().mockResolvedValue({
      id: "1",
      from: { name: "A", address: "a@b.com" },
      to: [{ name: "C", address: "c@d.com" }],
      cc: [],
      subject: "Test",
      body: "Hello",
      date: "2026-06-17T00:00:00Z",
      attachments: [],
      folder: "INBOX",
      flags: [],
    }),
    search: vi.fn<() => Promise<EmailMessage[]>>().mockResolvedValue([]),
  };
}

function createMockSmtp() {
  return {
    send: vi.fn<(draft: EmailDraft) => Promise<string>>().mockResolvedValue("msg123"),
  };
}

describe("GmailEmailClient", () => {
  it("delegates listFolders to imap client", async () => {
    const imap = createMockImap();
    const smtp = createMockSmtp();
    const client = new GmailEmailClient(imap as unknown as GmailImapClient, smtp as unknown as GmailSmtpSender);
    const folders = await client.listFolders();
    expect(folders).toEqual([{ name: "INBOX", path: "INBOX", delimiter: "." }]);
    expect(imap.listFolders).toHaveBeenCalled();
  });

  it("delegates listMessages to imap client", async () => {
    const imap = createMockImap();
    const smtp = createMockSmtp();
    const client = new GmailEmailClient(imap as unknown as GmailImapClient, smtp as unknown as GmailSmtpSender);
    await client.listMessages("INBOX", { limit: 10 });
    expect(imap.listMessages).toHaveBeenCalledWith("INBOX", { limit: 10 });
  });

  it("delegates getMessage to imap client", async () => {
    const imap = createMockImap();
    const smtp = createMockSmtp();
    const client = new GmailEmailClient(imap as unknown as GmailImapClient, smtp as unknown as GmailSmtpSender);
    const msg = await client.getMessage("1");
    expect(msg.id).toBe("1");
    expect(imap.getMessage).toHaveBeenCalledWith("1");
  });

  it("delegates send to smtp sender", async () => {
    const imap = createMockImap();
    const smtp = createMockSmtp();
    const client = new GmailEmailClient(imap as unknown as GmailImapClient, smtp as unknown as GmailSmtpSender);
    const draft: EmailDraft = { to: [{ address: "x@y.com" }], subject: "Hi", body: "Yo" };
    const messageId = await client.send(draft);
    expect(messageId).toBe("msg123");
    expect(smtp.send).toHaveBeenCalledWith(draft);
  });

  it("delegates search to imap client", async () => {
    const imap = createMockImap();
    const smtp = createMockSmtp();
    const client = new GmailEmailClient(imap as unknown as GmailImapClient, smtp as unknown as GmailSmtpSender);
    await client.search("from:alice");
    expect(imap.search).toHaveBeenCalledWith("from:alice");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/skills-email && npx vitest run test/gmail/client.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GmailEmailClient**

Create `packages/skills-email/src/gmail/client.ts`:

```ts
import type { GmailImapClient } from "./imap-client.js";
import type { GmailSmtpSender } from "./smtp-sender.js";
import type { EmailDraft, EmailFolder, EmailMessage, ListOptions } from "../types.js";

export class GmailEmailClient {
  constructor(
    private readonly imap: GmailImapClient,
    private readonly smtp: GmailSmtpSender,
  ) {}

  async listFolders(): Promise<EmailFolder[]> {
    return this.imap.listFolders();
  }

  async listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]> {
    return this.imap.listMessages(folder, opts);
  }

  async getMessage(id: string): Promise<EmailMessage> {
    return this.imap.getMessage(id);
  }

  async send(draft: EmailDraft): Promise<string> {
    return this.smtp.send(draft);
  }

  async search(query: string): Promise<EmailMessage[]> {
    return this.imap.search(query);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/skills-email && npx vitest run test/gmail/client.test.ts`

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-email/src/gmail/client.ts packages/skills-email/test/gmail/client.test.ts
git commit -m "feat(email): add GmailEmailClient composing IMAP and SMTP"
```

---

## Task 6: Microsoft Graph client + OAuth

**Files:**
- Create: `packages/skills-email/src/graph/oauth.ts`
- Create: `packages/skills-email/src/graph/graph-client.ts`
- Test: `packages/skills-email/test/graph/oauth.test.ts`
- Test: `packages/skills-email/test/graph/graph-client.test.ts`

- [ ] **Step 1: Write the failing test for GraphOAuth**

Create `packages/skills-email/test/graph/oauth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphOAuth } from "../../src/graph/oauth.js";
import type { Vault } from "@openjarvis/core";

function createMockVault(): { vault: Vault; store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    vault: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: vi.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
      delete: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
    },
    store,
  };
}

const config = {
  clientId: "test-client-id",
  tenant: "consumers",
};

describe("GraphOAuth", () => {
  let oauth: GraphOAuth;
  let mockFetch: ReturnType<typeof vi.fn>;
  let vaultStore: { vault: Vault; store: Map<string, string> };

  beforeEach(() => {
    vaultStore = createMockVault();
    mockFetch = vi.fn();
    oauth = new GraphOAuth(config, vaultStore.vault, mockFetch);
  });

  it("startDeviceCodeAuth calls device code endpoint and returns DeviceCodeInfo", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        device_code: "dc123",
        user_code: "ABC-XYZ",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
      }),
    });
    const info = await oauth.startDeviceCodeAuth();
    expect(info.deviceCode).toBe("dc123");
    expect(info.userCode).toBe("ABC-XYZ");
    expect(info.verificationUrl).toBe("https://microsoft.com/devicelogin");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("waitForAuth polls token endpoint and stores tokens", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "at123",
        refresh_token: "rt123",
        expires_in: 3600,
      }),
    });
    const result = await oauth.waitForAuth("dc123");
    expect(result.success).toBe(true);
    expect(vaultStore.store.get("graph:access-token")).toBe("at123");
    expect(vaultStore.store.get("graph:refresh-token")).toBe("rt123");
  });

  it("waitForAuth returns error on authorization_pending", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        error: "authorization_pending",
        error_description: "Authorization is pending",
      }),
    });
    const result = await oauth.waitForAuth("dc123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("authorization_pending");
  });

  it("refreshToken uses refresh_token from vault", async () => {
    vaultStore.store.set("graph:refresh-token", "rt-existing");
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "at-new",
        refresh_token: "rt-new",
        expires_in: 3600,
      }),
    });
    const result = await oauth.refreshToken();
    expect(result.success).toBe(true);
    expect(vaultStore.store.get("graph:access-token")).toBe("at-new");
    expect(vaultStore.store.get("graph:refresh-token")).toBe("rt-new");
  });

  it("refreshToken returns error when no refresh token stored", async () => {
    const result = await oauth.refreshToken();
    expect(result.success).toBe(false);
    expect(result.error).toContain("no refresh token");
  });

  it("getAccessToken returns stored token if not expired", async () => {
    const future = new Date(Date.now() + 600000).toISOString();
    vaultStore.store.set("graph:access-token", "at-valid");
    vaultStore.store.set("graph:token-expires", future);
    const token = await oauth.getAccessToken();
    expect(token).toBe("at-valid");
  });

  it("getAccessToken refreshes when token is near expiry", async () => {
    const nearExpiry = new Date(Date.now() + 200000).toISOString();
    vaultStore.store.set("graph:access-token", "at-old");
    vaultStore.store.set("graph:refresh-token", "rt-old");
    vaultStore.store.set("graph:token-expires", nearExpiry);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "at-refreshed",
        refresh_token: "rt-refreshed",
        expires_in: 3600,
      }),
    });
    const token = await oauth.getAccessToken();
    expect(token).toBe("at-refreshed");
  });
});
```

- [ ] **Step 2: Write the failing test for GraphEmailClient**

Create `packages/skills-email/test/graph/graph-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphEmailClient } from "../../src/graph/graph-client.js";
import type { EmailFolder, EmailMessage, EmailDraft } from "../../src/types.js";

function createMockFetch() {
  return vi.fn();
}

const mockAccessToken = "test-access-token";

describe("GraphEmailClient", () => {
  let client: GraphEmailClient;
  let mockFetch: ReturnType<typeof createMockFetch>;
  let getToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    getToken = vi.fn().mockResolvedValue(mockAccessToken);
    client = new GraphEmailClient({ getToken, fetch: mockFetch });
  });

  it("listFolders calls Graph API and maps to EmailFolder[]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: [
          { id: "folder1", displayName: "Inbox", totalItemCount: 10, unreadItemCount: 3 },
          { id: "folder2", displayName: "Sent Items", totalItemCount: 50, unreadItemCount: 0 },
        ],
      }),
    });
    const folders = await client.listFolders();
    expect(folders).toEqual([
      { name: "Inbox", path: "folder1", delimiter: "/", unreadCount: 3 },
      { name: "Sent Items", path: "folder2", delimiter: "/", unreadCount: 0 },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/mailFolders",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
  });

  it("listMessages calls Graph API and maps to EmailMessage[]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: [
          {
            id: "msg1",
            from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
            toRecipients: [{ emailAddress: { name: "Bob", address: "bob@example.com" } }],
            ccRecipients: [],
            subject: "Hello",
            body: { content: "Hi Bob", contentType: "text" },
            receivedDateTime: "2026-06-17T00:00:00Z",
            isRead: true,
          },
        ],
      }),
    });
    const messages = await client.listMessages("folder1", { limit: 10 });
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("msg1");
    expect(messages[0].subject).toBe("Hello");
  });

  it("getMessage fetches a single message", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: "msg42",
        from: { emailAddress: { name: "Dave", address: "dave@example.com" } },
        toRecipients: [{ emailAddress: { name: "Eve", address: "eve@example.com" } }],
        ccRecipients: [],
        subject: "Single",
        body: { content: "Body text", contentType: "text" },
        receivedDateTime: "2026-06-17T00:00:00Z",
        isRead: false,
      }),
    });
    const msg = await client.getMessage("msg42");
    expect(msg.id).toBe("msg42");
    expect(msg.subject).toBe("Single");
  });

  it("send posts to Graph sendMail endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202 });
    const draft: EmailDraft = {
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi",
    };
    const messageId = await client.send(draft);
    expect(messageId).toBe("sent");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("search calls Graph search endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: [
          {
            id: "msg1",
            from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
            toRecipients: [],
            ccRecipients: [],
            subject: "Re: Project",
            body: { content: "content", contentType: "text" },
            receivedDateTime: "2026-06-17T00:00:00Z",
            isRead: true,
          },
        ],
      }),
    });
    const results = await client.search("project update");
    expect(results).toHaveLength(1);
    expect(results[0].subject).toBe("Re: Project");
  });

  it("handles Graph API errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ error: { message: "Resource not found" } }),
    });
    await expect(client.getMessage("nonexistent")).rejects.toThrow("Resource not found");
  });

  it("retries on 429 with Retry-After header", async () => {
    const retryFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "0" }),
        json: () => Promise.resolve({ error: { message: "Too many requests" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });
    const c = new GraphEmailClient({ getToken, fetch: retryFetch });
    const folders = await c.listFolders();
    expect(folders).toEqual([]);
    expect(retryFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/skills-email && npx vitest run test/graph/`

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement GraphOAuth**

Create `packages/skills-email/src/graph/oauth.ts`:

```ts
import type { Vault } from "@openjarvis/core";
import type { DeviceCodeInfo, AuthResult } from "../types.js";

export interface GraphOAuthConfig {
  clientId: string;
  tenant: string;
}

export class GraphOAuth {
  private readonly tokenUrl: string;
  private readonly deviceCodeUrl: string;

  constructor(
    private readonly config: GraphOAuthConfig,
    private readonly vault: Vault,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {
    this.tokenUrl = `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`;
    this.deviceCodeUrl = `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/devicecode`;
  }

  async startDeviceCodeAuth(): Promise<DeviceCodeInfo> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: "Mail.Read Mail.ReadWrite Mail.Send offline_access",
    });
    const response = await this.fetchImpl(this.deviceCodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error_description: "unknown error" }));
      throw new Error(`device code request failed: ${error.error_description ?? response.statusText}`);
    }
    const data = await response.json();
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval ?? 5,
    };
  }

  async waitForAuth(deviceCode: string): Promise<AuthResult> {
    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant:device_code",
      client_id: this.config.clientId,
      device_code: deviceCode,
    });
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error ?? data.error_description ?? "unknown auth error" };
    }
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await this.vault.set("graph:access-token", data.access_token);
    await this.vault.set("graph:refresh-token", data.refresh_token);
    await this.vault.set("graph:token-expires", expiresAt);
    return { success: true };
  }

  async refreshToken(): Promise<AuthResult> {
    const refreshToken = await this.vault.get("graph:refresh-token");
    if (!refreshToken) {
      return { success: false, error: "no refresh token stored" };
    }
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      refresh_token: refreshToken,
    });
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error ?? data.error_description ?? "token refresh failed" };
    }
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await this.vault.set("graph:access-token", data.access_token);
    await this.vault.set("graph:refresh-token", data.refresh_token);
    await this.vault.set("graph:token-expires", expiresAt);
    return { success: true };
  }

  async getAccessToken(): Promise<string> {
    const expiresStr = await this.vault.get("graph:token-expires");
    if (expiresStr) {
      const expiresAt = new Date(expiresStr).getTime();
      const bufferMs = 5 * 60 * 1000;
      if (Date.now() < expiresAt - bufferMs) {
        const token = await this.vault.get("graph:access-token");
        if (token) return token;
      }
    }
    const result = await this.refreshToken();
    if (!result.success) {
      throw new Error(result.error ?? "failed to refresh token");
    }
    return (await this.vault.get("graph:access-token")) ?? "";
  }
}
```

- [ ] **Step 5: Implement GraphEmailClient**

Create `packages/skills-email/src/graph/graph-client.ts`:

```ts
import type { EmailFolder, EmailMessage, EmailDraft, ListOptions, DeviceCodeInfo, AuthResult } from "../types.js";

export interface GraphClientDeps {
  getToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export class GraphEmailClient {
  private readonly baseUrl = "https://graph.microsoft.com/v1.0";
  private readonly doFetch: typeof globalThis.fetch;

  constructor(private readonly deps: GraphClientDeps) {
    this.doFetch = deps.fetch ?? globalThis.fetch;
  }

  async listFolders(): Promise<EmailFolder[]> {
    const data = await this.graphGet("/me/mailFolders");
    return data.value.map((f: Record<string, unknown>) => ({
      name: String(f.displayName),
      path: String(f.id),
      delimiter: "/",
      unreadCount: f.unreadItemCount as number | undefined,
    }));
  }

  async listMessages(folderId: string, opts?: ListOptions): Promise<EmailMessage[]> {
    const limit = opts?.limit ?? 20;
    const skip = opts?.offset ?? 0;
    const data = await this.graphGet(
      `/me/mailFolders/${folderId}/messages?$top=${limit}&$skip=${skip}`,
    );
    return data.value.map((m: Record<string, unknown>) => this.mapMessage(m));
  }

  async getMessage(id: string): Promise<EmailMessage> {
    const data = await this.graphGet(`/me/messages/${id}`);
    return this.mapMessage(data);
  }

  async send(draft: EmailDraft): Promise<string> {
    const token = await this.deps.getToken();
    const body = this.buildSendMailBody(draft);
    const response = await this.doFetch(`${this.baseUrl}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.send(draft);
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message ?? `Graph API error: ${response.status}`);
    }
    return "sent";
  }

  async search(query: string): Promise<EmailMessage[]> {
    const data = await this.graphGet(`/me/messages?$search="${encodeURIComponent(query)}"`);
    return data.value.map((m: Record<string, unknown>) => this.mapMessage(m));
  }

  async startDeviceCodeAuth(): Promise<DeviceCodeInfo> {
    throw new Error("Use GraphOAuth.startDeviceCodeAuth() instead");
  }

  async waitForAuth(_deviceCode: string): Promise<AuthResult> {
    throw new Error("Use GraphOAuth.waitForAuth() instead");
  }

  async refreshToken(): Promise<AuthResult> {
    throw new Error("Use GraphOAuth.refreshToken() instead");
  }

  private async graphGet(path: string): Promise<Record<string, unknown>> {
    const token = await this.deps.getToken();
    let response = await this.doFetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      response = await this.doFetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message ?? `Graph API error: ${response.status}`);
    }
    return response.json();
  }

  private mapMessage(m: Record<string, unknown>): EmailMessage {
    const from = m.from as Record<string, Record<string, string>> | undefined;
    const toRecipients = (Array.isArray(m.toRecipients) ? m.toRecipients : []) as Record<string, Record<string, string>>[];
    const ccRecipients = (Array.isArray(m.ccRecipients) ? m.ccRecipients : []) as Record<string, Record<string, string>>[];
    const body = m.body as Record<string, string> | undefined;
    return {
      id: String(m.id),
      from: {
        name: from?.emailAddress?.name ?? "",
        address: from?.emailAddress?.address ?? "",
      },
      to: toRecipients.map((r) => ({
        name: r.emailAddress?.name ?? "",
        address: r.emailAddress?.address ?? "",
      })),
      cc: ccRecipients.map((r) => ({
        name: r.emailAddress?.name ?? "",
        address: r.emailAddress?.address ?? "",
      })),
      subject: String(m.subject ?? ""),
      body: body?.contentType === "html" ? "" : (body?.content ?? ""),
      htmlBody: body?.contentType === "html" ? body?.content : undefined,
      date: String(m.receivedDateTime ?? new Date().toISOString()),
      attachments: [],
      folder: "",
      flags: m.isRead ? ["\\Seen"] : [],
    };
  }

  private buildSendMailBody(draft: EmailDraft): Record<string, unknown> {
    const message: Record<string, unknown> = {
      subject: draft.subject,
      body: draft.htmlBody
        ? { contentType: "HTML", content: draft.htmlBody }
        : { contentType: "Text", content: draft.body },
      toRecipients: draft.to.map((r) => ({
        emailAddress: { name: r.name ?? r.address, address: r.address },
      })),
    };
    if (draft.cc?.length) {
      message.ccRecipients = draft.cc.map((r) => ({
        emailAddress: { name: r.name ?? r.address, address: r.address },
      }));
    }
    if (draft.attachments?.length) {
      message.attachments = draft.attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType,
        contentBytes: Buffer.from(a.content).toString("base64"),
      }));
    }
    return { message };
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/skills-email && npx vitest run test/graph/`

Expected: All 12 tests PASS (7 oauth + 7 graph-client minus 1 duplicate = ~13 total).

- [ ] **Step 7: Commit**

```bash
git add packages/skills-email/src/graph/ packages/skills-email/test/graph/
git commit -m "feat(email): add GraphOAuth and GraphEmailClient with device code flow"
```

---

## Task 7: Email tools (registration + routing)

**Files:**
- Create: `packages/skills-email/src/tools.ts`
- Test: `packages/skills-email/test/tools.test.ts`

- [ ] **Step 1: Write the failing test for email tools**

Create `packages/skills-email/test/tools.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import {
  createEmailSearchTool,
  createEmailReadTool,
  createEmailDraftTool,
  createEmailSendTool,
  registerEmailTools,
  type EmailToolClients,
} from "../src/tools.js";

const ctx = { agentId: "test-agent" };

function makeClients(): EmailToolClients {
  return {
    gmail: {
      listFolders: vi.fn().mockResolvedValue([{ name: "INBOX", path: "INBOX", delimiter: "." }]),
      listMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue({
        id: "1", from: { name: "A", address: "a@b.com" },
        to: [], cc: [], subject: "Test", body: "Hello",
        date: "2026-06-17T00:00:00Z", attachments: [], folder: "INBOX", flags: [],
      }),
      send: vi.fn().mockResolvedValue("msg123"),
      search: vi.fn().mockResolvedValue([]),
    },
    graph: {
      listFolders: vi.fn().mockResolvedValue([{ name: "Inbox", path: "inbox", delimiter: "/" }]),
      listMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue({
        id: "g1", from: { name: "A", address: "a@b.com" },
        to: [], cc: [], subject: "Test", body: "Hello",
        date: "2026-06-17T00:00:00Z", attachments: [], folder: "Inbox", flags: [],
      }),
      send: vi.fn().mockResolvedValue("sent"),
      search: vi.fn().mockResolvedValue([]),
      startDeviceCodeAuth: vi.fn().mockResolvedValue({
        deviceCode: "dc123", userCode: "ABC-XYZ",
        verificationUrl: "https://microsoft.com/devicelogin",
        expiresIn: 900, interval: 5,
      }),
      waitForAuth: vi.fn().mockResolvedValue({ success: true }),
      refreshToken: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

describe("createEmailSearchTool", () => {
  it("registers with email:read capability", () => {
    const tool = createEmailSearchTool(makeClients());
    expect(tool.name).toBe("email_search");
    expect(tool.capabilities).toEqual([{ name: "email:read" }]);
  });

  it("calls gmail search when provider is gmail", async () => {
    const clients = makeClients();
    const tool = createEmailSearchTool(clients);
    await tool.handler({ provider: "gmail", query: "from:alice" }, ctx);
    expect(clients.gmail!.search).toHaveBeenCalledWith("from:alice");
  });

  it("calls graph search when provider is graph", async () => {
    const clients = makeClients();
    const tool = createEmailSearchTool(clients);
    await tool.handler({ provider: "graph", query: "project update" }, ctx);
    expect(clients.graph!.search).toHaveBeenCalledWith("project update");
  });
});

describe("createEmailReadTool", () => {
  it("registers with email:read capability", () => {
    const tool = createEmailReadTool(makeClients());
    expect(tool.name).toBe("email_read");
    expect(tool.capabilities).toEqual([{ name: "email:read" }]);
  });

  it("calls getMessage when messageId is provided", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", messageId: "42" }, ctx);
    expect(clients.gmail!.getMessage).toHaveBeenCalledWith("42");
  });

  it("calls listMessages when no messageId is provided", async () => {
    const clients = makeClients();
    const tool = createEmailReadTool(clients);
    await tool.handler({ provider: "gmail", folder: "INBOX" }, ctx);
    expect(clients.gmail!.listMessages).toHaveBeenCalledWith("INBOX", expect.any(Object));
  });
});

describe("createEmailDraftTool", () => {
  it("registers with email:send capability", () => {
    const tool = createEmailDraftTool(makeClients());
    expect(tool.name).toBe("email_draft");
    expect(tool.capabilities).toEqual([{ name: "email:send" }]);
  });

  it("returns a draftId and preview without sending", async () => {
    const clients = makeClients();
    const tool = createEmailDraftTool(clients);
    const result = await tool.handler({
      provider: "gmail",
      to: [{ address: "bob@example.com" }],
      subject: "Test draft",
      body: "Draft body",
    }, ctx);
    expect(result.draftId).toBeDefined();
    expect(result.preview.subject).toBe("Test draft");
    expect(clients.gmail!.send).not.toHaveBeenCalled();
  });
});

describe("createEmailSendTool", () => {
  it("registers with email:send capability", () => {
    const tool = createEmailSendTool(makeClients());
    expect(tool.name).toBe("email_send");
    expect(tool.capabilities).toEqual([{ name: "email:send" }]);
  });

  it("calls gmail send when provider is gmail", async () => {
    const clients = makeClients();
    const tool = createEmailSendTool(clients);
    await tool.handler({
      provider: "gmail",
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi Bob",
    }, ctx);
    expect(clients.gmail!.send).toHaveBeenCalledWith(expect.objectContaining({
      to: [{ address: "bob@example.com" }],
      subject: "Hello",
      body: "Hi Bob",
    }));
  });
});

describe("registerEmailTools", () => {
  it("registers all four email tools", () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("email_search");
    expect(names).toContain("email_read");
    expect(names).toContain("email_draft");
    expect(names).toContain("email_send");
  });

  it("denies email_send without email:send capability", async () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await registry.invoke(
      { id: "c1", tool: "email_send", args: { provider: "gmail", to: [{ address: "x@y.com" }], subject: "Hi", body: "yo" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("allows email_search with email:read capability", async () => {
    const clients = makeClients();
    const registry = new ToolRegistry();
    registerEmailTools(registry, clients);
    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "email:read" }] };
    const result = await registry.invoke(
      { id: "c2", tool: "email_search", args: { provider: "gmail", query: "test" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/skills-email && npx vitest run test/tools.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement email tools**

Create `packages/skills-email/src/tools.ts`:

```ts
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "@openjarvis/core";
import type { ToolRegistry } from "@openjarvis/core";
import type { EmailToolClients, EmailDraft } from "./types.js";
import { EmailMessageSchema, ListOptionsSchema } from "./types.js";

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/skills-email && npx vitest run test/tools.test.ts`

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/skills-email/src/tools.ts packages/skills-email/test/tools.test.ts
git commit -m "feat(email): add email tools with search, read, draft, send and provider routing"
```

---

## Task 8: Update index.ts and run full test suite

**Files:**
- Modify: `packages/skills-email/src/index.ts`
- Modify: `packages/skills-email/src/gmail/client.ts` (ensure re-export)

- [ ] **Step 1: Update src/index.ts with all exports**

```ts
export type { EmailClient, EmailFolder, EmailMessage, EmailAttachment, EmailDraft, ListOptions, EmailConfig, EmailToolClients, DeviceCodeInfo, AuthResult } from "./types.js";
export type { GmailImapConfig } from "./gmail/imap-client.js";
export type { GmailSmtpConfig } from "./gmail/smtp-sender.js";
export { GmailImapClient } from "./gmail/imap-client.js";
export { GmailSmtpSender } from "./gmail/smtp-sender.js";
export { GmailEmailClient } from "./gmail/client.js";
export { GraphOAuth } from "./graph/oauth.js";
export type { GraphOAuthConfig } from "./graph/oauth.js";
export { GraphEmailClient } from "./graph/graph-client.js";
export { createEmailSearchTool, createEmailReadTool, createEmailDraftTool, createEmailSendTool, registerEmailTools } from "./tools.js";
export { EmailFolderSchema, EmailAttachmentSchema, EmailMessageSchema, EmailDraftSchema, ListOptionsSchema } from "./types.js";
```

- [ ] **Step 2: Run the full skills-email test suite**

Run: `cd packages/skills-email && npx vitest run`

Expected: All tests PASS (types + imap-client + smtp-sender + gmail-client + oauth + graph-client + tools).

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npx tsc -b packages/skills-email`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/skills-email/src/index.ts
git commit -m "feat(email): update index.ts with all exports"
```

---

## Task 9: Router and Pool integration

**Files:**
- Modify: `packages/jarvis/src/nexus/router.ts`
- Modify: `packages/jarvis/src/nexus/pool.ts`

- [ ] **Step 1: Add email routes to router**

In `packages/jarvis/src/nexus/router.ts`, add email intent mappings to the constructor's `rules` Map:

```ts
["search_email", this.routeToEmail.bind(this)],
["read_email", this.routeToEmail.bind(this)],
["draft_email", this.routeToEmail.bind(this)],
["send_email", this.routeToEmail.bind(this)],
```

And add the method:

```ts
private routeToEmail(intent: Intent): DispatchPlan {
  return {
    parallel: [],
    sequential: [],
    primary: { agentId: "email", confidence: intent.confidence, required: true },
  };
}
```

- [ ] **Step 2: Add email agent to pool**

In `packages/jarvis/src/nexus/pool.ts`, add to the `agents` Map:

```ts
[
  "email",
  {
    id: "email",
    name: "Email Agent",
    role: "communication",
    capabilities: ["email:read", "email:send"],
    active: true,
  },
],
```

And add to the `factories` Map:

```ts
["email", async () => ({ messageId: "mock-email-123" })],
```

- [ ] **Step 3: Run jarvis typecheck**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npx tsc -b packages/jarvis`

Expected: No errors.

- [ ] **Step 4: Run jarvis tests**

Run: `cd packages/jarvis && npx vitest run`

Expected: All existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/nexus/router.ts packages/jarvis/src/nexus/pool.ts
git commit -m "feat(email): add email agent routes and pool registration"
```

---

## Task 10: Full build, test, coverage gate

- [ ] **Step 1: Run full monorepo build**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npm run build`

Expected: Clean build with no errors.

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npm test`

Expected: All tests pass (existing + new email tests).

- [ ] **Step 3: Run coverage check**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npm run test:coverage`

Expected: Overall coverage ≥ 99%.

- [ ] **Step 4: Run lint and format**

Run: `cd /Users/parijatmukherjee/workspace/openhawkins && npm run lint && npm run format:check`

Expected: No errors.

- [ ] **Step 5: Commit any lint/format fixes**

```bash
git add -A
git commit -m "chore(email): fix lint and format issues"
```

Only if needed — if everything passes clean, skip this step.