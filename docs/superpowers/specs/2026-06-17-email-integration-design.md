# Email Integration Design — @openjarvis/skills-email

**Date:** 2026-06-17
**Phase:** 2 (Daily Workflows)
**Status:** Draft

## 1. Overview

Unified email integration supporting Gmail (IMAP/SMTP) and Microsoft Outlook (Graph API). Provides four tools (`email_search`, `email_read`, `email_draft`, `email_send`) behind a common `EmailClient` interface, registered with the `ToolRegistry` and gated by capability + approval checks.

## 2. Architecture

Two provider implementations behind a unified interface:

```
Agent → ToolRegistry → email_search / email_read / email_draft / email_send
                              ↓
                     registerEmailTools(registry, clients)
                              ↓
                   EmailClient (interface)
                    /              \
            GmailClient        GraphClient
           (node-imap +       (Microsoft Graph API
            nodemailer)        + OAuth2 device code)
```

### 2.1 EmailClient Interface

```ts
interface EmailClient {
  listFolders(): Promise<EmailFolder[]>;
  listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]>;
  getMessage(id: string): Promise<EmailMessage>;
  send(draft: EmailDraft): Promise<string>;
  search(query: string): Promise<EmailMessage[]>;
}

interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  unreadCount?: number;
}

interface EmailMessage {
  id: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  subject: string;
  body: string;
  htmlBody?: string;
  date: Date;
  attachments: EmailAttachment[];
  folder: string;
  flags: string[];
}

interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  inline: boolean;
}

interface EmailDraft {
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

interface ListOptions {
  limit?: number;
  offset?: number;
  sort?: "date" | "subject" | "from";
  order?: "asc" | "desc";
  unreadOnly?: boolean;
}
```

### 2.2 Tool Definitions

| Tool           | Capability   | Approval Gate | Description                                        |
| -------------- | ------------ | ------------- | -------------------------------------------------- |
| `email_search` | `email:read` | No            | Search messages by query string                    |
| `email_read`   | `email:read` | No            | Read a single message or list messages in a folder |
| `email_draft`  | `email:send` | No            | Create a draft (does not send)                     |
| `email_send`   | `email:send` | Yes           | Send an email; requires approval if tainted        |

### 2.3 Tool Args & Results (Zod schemas)

```ts
// email_search
args: z.object({
  provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
  query: z.string().describe("IMAP or Graph search query"),
  folder: z.string().optional().default("INBOX"),
  limit: z.number().optional().default(20),
}),
result: z.object({
  messages: z.array(EmailMessageSchema),
  total: z.number(),
}),

// email_read
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

// email_draft (creates a preview, does not persist or send)
args: z.object({
  provider: z.enum(["gmail", "graph"]).optional().default("gmail"),
  to: z.array(z.object({ name: z.string().optional(), address: z.string() })),
  cc: z.array(z.object({ name: z.string().optional(), address: z.string() })).optional(),
  subject: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
}),
result: z.object({
  draftId: z.string(),  // UUID v4, stateless — just a reference for the agent to use with email_send
  preview: z.object({ to: z.array(z.any()), subject: z.string(), bodyPreview: z.string() }),
}),

// email_send
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
    content: z.instanceof(Buffer),
  })).optional(),
}),
result: z.object({ messageId: z.string() }),
```

## 3. Provider Implementations

### 3.1 GmailClient (IMAP + SMTP)

**Reading (IMAP via node-imap):**

- `listFolders()`: calls `imap.getBoxes()`, maps to `EmailFolder[]`
- `listMessages(folder, opts)`: opens mailbox, fetches UID + envelope, paginates with `opts.limit/offset`
- `getMessage(id)`: fetches full message by UID, parses with `mailparser`, returns `EmailMessage`
- `search(query)`: uses IMAP search criteria (e.g., `['FROM', 'x']`, `['SUBJECT', 'y']`, `['UNSEEN']`)

**Sending (SMTP via nodemailer):**

- `send(draft)`: creates transport, sends via SMTP with app password auth
- Default: `smtp.gmail.com:465`, secure true

**Auth:** App password stored in Vault under key `gmail:app-password`. No OAuth needed for Gmail.

**Connection management:**

- Lazy connect on first operation
- Auto-reconnect on connection drop
- Idle timeout: 5 minutes of inactivity → disconnect
- Max 2 concurrent IMAP connections per client instance

### 3.2 GraphClient (Microsoft Graph API)

**Reading & Sending (REST API v1.0):**

- `listFolders()`: `GET /me/mailFolders`
- `listMessages(folder, opts)`: `GET /me/mailFolders/{id}/messages?$top={limit}&$skip={offset}`
- `getMessage(id)`: `GET /me/messages/{id}`
- `send(draft)`: `POST /me/sendMail` with JSON body
- `search(query)`: `GET /me/messages?$search="{query}"`

**OAuth2 Device Code Flow:**

```
1. POST /consumers/oauth2/v2.0/devicecode
   → { device_code, user_code, verification_url, expires_in, interval }

2. User visits verification_url, enters user_code, grants permission

3. Poll: POST /consumers/oauth2/v2.0/token
   body: { grant_type: "urn:ietf:params:oauth:grant:device_code", device_code }
   → { access_token, refresh_token, expires_in }

4. Store in Vault:
   - graph:access-token
   - graph:refresh-token
   - graph:token-expires (ISO timestamp)

5. On 401 response: refresh using refresh_token
   POST /consumers/oauth2/v2.0/token
   body: { grant_type: "refresh_token", refresh_token, ... }
   → new tokens, update Vault
```

**Token management:**

- Auto-refresh when `expires_in - 300s < now` (5-minute buffer)
- On 401: attempt refresh once, retry the original request
- On refresh failure: surface clear error, do not retry further
- Scopes: `Mail.Read Mail.ReadWrite Mail.Send offline_access`

**Rate limiting:**

- Honor `Retry-After` header on 429 responses
- Default: 4 requests/second per client instance
- Exponential backoff: 1s, 2s, 4s on transient failures

### 3.3 EmailToolClients Interface

Following the established pattern from Discord/web_fetch:

```ts
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
```

## 4. Error Handling

| Scenario                                   | Behavior                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| IMAP connection drop                       | Retry with exponential backoff (3 attempts: 1s, 2s, 4s) |
| IMAP auth failure (bad app password)       | Surface clear error, no retry                           |
| Graph 401 Unauthorized                     | Auto-refresh token, retry once                          |
| Graph 429 Rate Limited                     | Honor Retry-After header, wait then retry               |
| Graph auth failure (expired/revoked token) | Surface clear error, prompt re-auth                     |
| Network timeout                            | 30s default, configurable via `EmailConfig.timeout`     |
| Invalid email address in send              | Zod validation catches before handler                   |
| Attachment too large                       | Reject with error if > 25MB (Gmail) or 150MB (Graph)    |

All tool handlers follow the never-throws pattern: errors are caught and returned as `{ ok: false, error: string }`.

## 5. Package Structure

```
packages/skills-email/
  src/
    index.ts                — re-exports
    types.ts                — EmailClient, EmailMessage, EmailFolder, EmailDraft, etc.
    gmail/
      imap-client.ts        — GmailClient (node-imap) implements reading
      smtp-sender.ts        — wraps nodemailer for sending
      client.ts             — GmailEmailClient composes ImapClient + SmtpSender
      tools.ts              — registerGmailTools(registry, gmailClient)
    graph/
      graph-client.ts       — GraphEmailClient (REST API)
      oauth.ts              — device code flow + token refresh
      tools.ts              — registerGraphTools(registry, graphClient)
    tools.ts                — registerEmailTools(registry, clients) routes by provider
  tests/
    gmail/
      imap-client.test.ts   — mock node-imap
      smtp-sender.test.ts   — mock nodemailer
      tools.test.ts         — capability gates, Zod validation
    graph/
      graph-client.test.ts  — nock for HTTP mocking
      oauth.test.ts         — device code flow, refresh
      tools.test.ts         — capability gates, Zod validation
    tools.test.ts           — routing, provider selection
  package.json
  tsconfig.json
  vitest.config.ts
```

## 6. Configuration (DesktopStore Extension)

```ts
// Added to AppSettings.skills
interface EmailConfig {
  gmail?: {
    imap: string; // default: "imap.gmail.com"
    smtp: string; // default: "smtp.gmail.com"
    imapPort?: number; // default: 993
    smtpPort?: number; // default: 465
  };
  graph?: {
    clientId: string;
    tenant: string; // default: "consumers"
  };
  timeout?: number; // default: 30000 (ms)
  maxAttachmentSize?: number; // default: 26214400 (25MB)
}
```

Secrets stored in Vault:

- `gmail:app-password` — Gmail app password
- `graph:access-token` — current Graph access token
- `graph:refresh-token` — Graph refresh token
- `graph:token-expires` — ISO timestamp of token expiry

## 7. Capabilities

Added to `CapabilityName` union in `packages/core/src/security/capability.ts`:

```ts
| "email:read"
| "email:send"
```

## 8. Router & Pool Integration

**Router** (`packages/jarvis/src/nexus/router.ts`):

- Add routes: `search_email`, `read_email`, `draft_email`, `send_email`
- Map to `email_search`, `email_read`, `email_draft`, `email_send` tools

**Pool** (`packages/jarvis/src/nexus/pool.ts`):

- Add `email` agent with `email:read` + `email:send` capabilities

## 9. Security Considerations

- `email_send` requires approval gate: if email content is tainted (from external source), `requiresApproval()` forces human review
- Email addresses and tokens are redacted by existing `redact.ts` patterns
- App passwords and OAuth tokens stored in Vault (AES-256-GCM encrypted)
- Graph OAuth scopes limited to `Mail.Read Mail.ReadWrite Mail.Send offline_access` — no calendar, contacts, or admin scopes
- IMAP connections use TLS (port 993)
- SMTP connections use TLS (port 465)
- Attachment content not stored in memory beyond what's needed for the current operation

## 10. Dependencies

| Package            | Version      | Purpose                                           |
| ------------------ | ------------ | ------------------------------------------------- |
| `node-imap`        | ^0.9.0       | IMAP client for Gmail reading                     |
| `mailparser`       | ^3.7.0       | Parse raw MIME messages into structured objects   |
| `nodemailer`       | ^6.9.0       | SMTP client for Gmail sending                     |
| `@openjarvis/core` | workspace:\* | ToolDefinition, ToolRegistry, Vault, capabilities |

No OAuth library — device code flow and token refresh are implemented with plain `fetch()` calls.

## 11. Testing Strategy

- **GmailClient**: Mock `node-imap` events, test folder listing, message search, message fetch, pagination, connection errors
- **SmtpSender**: Mock `nodemailer.createTransport`, test send, attachment handling, auth errors
- **GraphClient**: Use `nock` to mock Graph API responses, test CRUD, pagination, search
- **OAuth**: Mock `fetch()` for device code flow, token exchange, refresh, error scenarios
- **Tools**: Test capability gating (`email:read`, `email:send`), approval gate on `email_send`, Zod validation on args/results, never-throws semantics
- **Routing**: Test provider selection (gmail vs graph), fallback when provider not configured
- **Target**: 100% statement coverage, following Discord (37 tests) and web_fetch (10 tests) patterns
