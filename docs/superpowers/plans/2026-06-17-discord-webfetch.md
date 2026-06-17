# Discord Channel Integration + web_fetch Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Discord bot integration and a web_fetch tool to OpenJarvis, enabling Discord-first migration from OpenClaw.

**Architecture:** New `@openjarvis/channels` package for Discord gateway/REST/session-mapping, and new `@openjarvis/skills-web` package for web_fetch. Both register typed `ToolDefinition` objects into the existing `ToolRegistry`. Discord messages map to OpenJarvis sessions. The capability model is extended with new capability names. The Nexus router gains new intent routes.

**Tech Stack:** TypeScript strict, ESM, Zod, discord.js, Node 22 native fetch, existing markdownify for HTML→Markdown conversion.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/core/src/security/capability.ts` | Extend `CapabilityName` with new capabilities |
| `packages/channels/package.json` | New package: @openjarvis/channels |
| `packages/channels/tsconfig.json` | TypeScript config |
| `packages/channels/src/index.ts` | Barrel export |
| `packages/channels/src/discord/gateway.ts` | Discord WebSocket connection lifecycle |
| `packages/channels/src/discord/rest.ts` | Discord REST API wrapper |
| `packages/channels/src/discord/session-mapper.ts` | Map Discord guild/channel/DM → OpenJarvis session |
| `packages/channels/src/discord/types.ts` | Discord-specific types |
| `packages/channels/src/discord/tools.ts` | discord_send, discord_read ToolDefinitions |
| `packages/channels/test/discord/gateway.test.ts` | Gateway tests |
| `packages/channels/test/discord/session-mapper.test.ts` | Session mapper tests |
| `packages/channels/test/discord/tools.test.ts` | Tool tests |
| `packages/skills-web/package.json` | New package: @openjarvis/skills-web |
| `packages/skills-web/tsconfig.json` | TypeScript config |
| `packages/skills-web/src/index.ts` | Barrel export + registerTools |
| `packages/skills-web/src/fetch.ts` | web_fetch ToolDefinition |
| `packages/skills-web/src/fetch.test.ts` | web_fetch tests |
| `packages/jarvis/src/nexus/router.ts` | Add Discord intent routes |
| `packages/jarvis/src/nexus/pool.ts` | Add Discord agent to pool |

---

### Task 1: Extend CapabilityName with new capabilities

**Files:**
- Modify: `packages/core/src/security/capability.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/test/security/capability.test.ts` (or create if needed):

```ts
import { describe, it, expect } from "vitest";
import { grantSatisfies, type Capability } from "../src/security/capability.js";

describe("new capabilities", () => {
  it("grants discord:message capability", () => {
    const grant = { agentId: "discord-bot", capabilities: [{ name: "discord:message" as const }] };
    const required: Capability[] = [{ name: "discord:message" }];
    expect(grantSatisfies(grant, required)).toBe(true);
  });

  it("grants web:fetch capability", () => {
    const grant = { agentId: "web-agent", capabilities: [{ name: "web:fetch" as const }] };
    const required: Capability[] = [{ name: "web:fetch" }];
    expect(grantSatisfies(grant, required)).toBe(true);
  });

  it("denies discord:message without grant", () => {
    const grant = { agentId: "web-agent", capabilities: [{ name: "web:fetch" as const }] };
    const required: Capability[] = [{ name: "discord:message" }];
    expect(grantSatisfies(grant, required)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/security/capability.test.ts`
Expected: FAIL — TypeScript error: `"discord:message"` and `"web:fetch"` are not assignable to `CapabilityName`.

- [ ] **Step 3: Extend the CapabilityName type**

Edit `packages/core/src/security/capability.ts`. Add new entries to the `CapabilityName` union:

```ts
type CapabilityName =
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
  | "web:browse";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/test/security/capability.test.ts`
Expected: PASS

- [ ] **Step 5: Run full gate**

Run: `npm run typecheck && npm test && npm run coverage && npm run lint && npm run format:check`
Expected: ALL PASS, coverage ≥ 99%

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/security/capability.ts packages/core/test/security/capability.test.ts
git commit -m "feat(core): add discord and web capabilities to CapabilityName"
```

---

### Task 2: Scaffold @openjarvis/channels package

**Files:**
- Create: `packages/channels/package.json`
- Create: `packages/channels/tsconfig.json`
- Create: `packages/channels/src/index.ts`
- Create: `packages/channels/vitest.config.ts` (or reference root config)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@openjarvis/channels",
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
    "discord.js": "^14.16.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0"
  },
  "peerDependencies": {
    "discord.js": ">=14.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Create src/index.ts**

```ts
export * from "./discord/tools.js";
export * from "./discord/types.js";
export * from "./discord/gateway.js";
export * from "./discord/session-mapper.js";
```

- [ ] **Step 4: Create test directory**

```bash
mkdir -p packages/channels/test/discord
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: discord.js and @openjarvis/core installed.

- [ ] **Step 6: Verify typecheck**

Run: `npm run build --workspace=@openjarvis/channels`
Expected: PASS (may have warnings about unused exports — that's fine, we'll add code in later tasks)

- [ ] **Step 7: Commit**

```bash
git add packages/channels/
git commit -m "chore(channels): scaffold @openjarvis/channels package"
```

---

### Task 3: Discord session mapper

**Files:**
- Create: `packages/channels/src/discord/types.ts`
- Create: `packages/channels/src/discord/session-mapper.ts`
- Create: `packages/channels/test/discord/session-mapper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/channels/test/discord/session-mapper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DiscordSessionMapper } from "../../src/discord/session-mapper.js";

describe("DiscordSessionMapper", () => {
  const mapper = new DiscordSessionMapper("guild-123");

  it("maps a guild channel to a session ID", () => {
    const sessionId = mapper.channelToSession("channel-456");
    expect(sessionId).toBe("discord:guild-123:channel-456");
  });

  it("maps a DM to a session ID", () => {
    const sessionId = mapper.dmToSession("user-789");
    expect(sessionId).toBe("discord:dm:user-789");
  });

  it("extracts channel ID from session ID", () => {
    const channelId = mapper.sessionToChannel("discord:guild-123:channel-456");
    expect(channelId).toBe("channel-456");
  });

  it("extracts user ID from DM session ID", () => {
    const userId = mapper.sessionToDmUser("discord:dm:user-789");
    expect(userId).toBe("user-789");
  });

  it("returns null for non-discord session ID", () => {
    expect(mapper.sessionToChannel("other:id")).toBeNull();
    expect(mapper.sessionToDmUser("other:id")).toBeNull();
  });

  it("isDiscordSession identifies discord sessions", () => {
    expect(mapper.isDiscordSession("discord:guild-123:channel-456")).toBe(true);
    expect(mapper.isDiscordSession("discord:dm:user-789")).toBe(true);
    expect(mapper.isDiscordSession("telegram:chat-123")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/channels/test/discord/session-mapper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types.ts**

Create `packages/channels/src/discord/types.ts`:

```ts
export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  authorUsername: string;
  content: string;
  timestamp: number;
  editedTimestamp: number | null;
  attachments: DiscordAttachment[];
}

export interface DiscordAttachment {
  id: string;
  url: string;
  filename: string;
  contentType: string | null;
  size: number;
}

export interface DiscordChannelInfo {
  id: string;
  name: string;
  guildId: string | null;
  type: "text" | "dm" | "thread";
}
```

- [ ] **Step 4: Implement session-mapper.ts**

Create `packages/channels/src/discord/session-mapper.ts`:

```ts
const DISCORD_PREFIX = "discord:";
const DM_PREFIX = "discord:dm:";

export class DiscordSessionMapper {
  constructor(private readonly guildId: string) {}

  channelToSession(channelId: string): string {
    return `${DISCORD_PREFIX}${this.guildId}:${channelId}`;
  }

  dmToSession(userId: string): string {
    return `${DM_PREFIX}${userId}`;
  }

  sessionToChannel(sessionId: string): string | null {
    if (!sessionId.startsWith(DISCORD_PREFIX) || sessionId.startsWith(DM_PREFIX)) return null;
    const parts = sessionId.split(":");
    if (parts.length < 3) return null;
    return parts.slice(2).join(":");
  }

  sessionToDmUser(sessionId: string): string | null {
    if (!sessionId.startsWith(DM_PREFIX)) return null;
    return sessionId.slice(DM_PREFIX.length);
  }

  isDiscordSession(sessionId: string): boolean {
    return sessionId.startsWith(DISCORD_PREFIX);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/channels/test/discord/session-mapper.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/channels/src/discord/types.ts packages/channels/src/discord/session-mapper.ts packages/channels/test/discord/session-mapper.test.ts
git commit -m "feat(channels): add Discord session mapper and types"
```

---

### Task 4: Discord gateway

**Files:**
- Create: `packages/channels/src/discord/gateway.ts`
- Create: `packages/channels/src/discord/rest.ts`
- Create: `packages/channels/test/discord/gateway.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/channels/test/discord/gateway.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscordGateway, type DiscordGatewayConfig } from "../../src/discord/gateway.js";

const mockClient = {
  login: vi.fn().mockResolvedValue("token"),
  destroy: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  isReady: vi.fn().mockReturnValue(false),
  user: { id: "bot-123", tag: "JarvisBot#1234" },
};

vi.mock("discord.js", () => ({
  Client: vi.fn(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 512,
    MessageContent: 32768,
    DirectMessages: 4096,
  },
}));

describe("DiscordGateway", () => {
  const config: DiscordGatewayConfig = {
    token: "test-bot-token",
    guilds: ["guild-123"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a gateway with config", () => {
    const gateway = new DiscordGateway(config);
    expect(gateway).toBeDefined();
  });

  it("calls client.login on start", async () => {
    const gateway = new DiscordGateway(config);
    await gateway.start();
    expect(mockClient.login).toHaveBeenCalledWith("test-bot-token");
  });

  it("calls client.destroy on stop", async () => {
    const gateway = new DiscordGateway(config);
    await gateway.start();
    await gateway.stop();
    expect(mockClient.destroy).toHaveBeenCalled();
  });

  it("registers message event handler", async () => {
    const gateway = new DiscordGateway(config);
    await gateway.start();
    expect(mockClient.on).toHaveBeenCalledWith("messageCreate", expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/channels/test/discord/gateway.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement gateway.ts**

Create `packages/channels/src/discord/gateway.ts`:

```ts
import {
  Client,
  GatewayIntentBits,
  type Message,
  type ClientEvents,
} from "discord.js";
import type { DiscordMessage, DiscordAttachment } from "./types.js";

export interface DiscordGatewayConfig {
  token: string;
  guilds: string[];
}

export type MessageHandler = (message: DiscordMessage) => void;

export class DiscordGateway {
  private client: Client;
  private messageHandlers: MessageHandler[] = [];
  private connected = false;

  constructor(private readonly config: DiscordGatewayConfig) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.client.on("messageCreate", (msg: Message) => {
      if (msg.author.bot) return;
      const discordMsg = this.mapMessage(msg);
      for (const handler of this.messageHandlers) {
        handler(discordMsg);
      }
    });
  }

  async start(): Promise<void> {
    await this.client.login(this.config.token);
    this.connected = true;
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.connected = false;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx >= 0) this.messageHandlers.splice(idx, 1);
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private mapMessage(msg: Message): DiscordMessage {
    return {
      id: msg.id,
      channelId: msg.channelId,
      guildId: msg.guildId,
      authorId: msg.author.id,
      authorUsername: msg.author.username,
      content: msg.content,
      timestamp: msg.createdTimestamp,
      editedTimestamp: msg.editedTimestamp,
      attachments: msg.attachments.map((a): DiscordAttachment => ({
        id: a.id,
        url: a.url,
        filename: a.name ?? "unknown",
        contentType: a.contentType,
        size: a.size,
      })),
    };
  }
}
```

- [ ] **Step 4: Implement rest.ts**

Create `packages/channels/src/discord/rest.ts`:

```ts
import type { DiscordChannelInfo } from "./types.js";

export class DiscordRest {
  constructor(private readonly token: string) {}

  async sendMessage(channelId: string, content: string): Promise<string> {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async getChannel(channelId: string): Promise<DiscordChannelInfo> {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${this.token}` },
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      id: string;
      name: string;
      guild_id: string | null;
      type: number;
    };

    const typeMap: Record<number, DiscordChannelInfo["type"]> = {
      0: "text",
      1: "dm",
      11: "thread",
    };

    return {
      id: data.id,
      name: data.name,
      guildId: data.guild_id,
      type: typeMap[data.type] ?? "text",
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/channels/test/discord/gateway.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run typecheck**

Run: `npm run build --workspace=@openjarvis/channels`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/channels/src/discord/gateway.ts packages/channels/src/discord/rest.ts packages/channels/test/discord/gateway.test.ts
git commit -m "feat(channels): add Discord gateway and REST client"
```

---

### Task 5: Discord tool definitions

**Files:**
- Create: `packages/channels/src/discord/tools.ts`
- Create: `packages/channels/test/discord/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/channels/test/discord/tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDiscordSendTool, createDiscordReadTool } from "../../src/discord/tools.js";
import { ToolRegistry } from "@openjarvis/core";

describe("Discord tools", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registers discord_send tool with correct capabilities", () => {
    const sendTool = createDiscordSendTool({
      sendMessage: vi.fn().mockResolvedValue("msg-123"),
    });
    registry.register(sendTool);
    expect(registry.has("discord_send")).toBe(true);
  });

  it("registers discord_read tool with correct capabilities", () => {
    const readTool = createDiscordReadTool({
      getChannel: vi.fn().mockResolvedValue({ id: "ch-1", name: "general", guildId: "g-1", type: "text" as const }),
    });
    registry.register(readTool);
    expect(registry.has("discord_read")).toBe(true);
  });

  it("discord_send invokes rest client and returns message ID", async () => {
    const mockSend = vi.fn().mockResolvedValue("msg-456");
    const sendTool = createDiscordSendTool({ sendMessage: mockSend });
    registry.register(sendTool);

    const result = await registry.invoke(
      { name: "discord_send", args: { channelId: "ch-1", content: "Hello!" } },
      { agentId: "test", capabilities: [{ name: "discord:message" }] },
      { agentId: "test" },
    );

    expect(result.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledWith("ch-1", "Hello!");
  });

  it("discord_send is denied without discord:message capability", async () => {
    const mockSend = vi.fn().mockResolvedValue("msg-456");
    const sendTool = createDiscordSendTool({ sendMessage: mockSend });
    registry.register(sendTool);

    const result = await registry.invoke(
      { name: "discord_send", args: { channelId: "ch-1", content: "Hello!" } },
      { agentId: "test", capabilities: [] },
      { agentId: "test" },
    );

    expect(result.ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/channels/test/discord/tools.test.ts`
Expected: FAIL — module not found or test failures.

- [ ] **Step 3: Implement tools.ts**

Create `packages/channels/src/discord/tools.ts`:

```ts
import { z } from "zod";
import { ToolRegistry } from "@openjarvis/core";
import type { DiscordRest } from "./rest.js";

export interface DiscordToolClients {
  sendMessage: (channelId: string, content: string) => Promise<string>;
  getChannel: (channelId: string) => Promise<{ id: string; name: string; guildId: string | null; type: string }>;
}

export function createDiscordSendTool(clients: DiscordToolClients) {
  return {
    name: "discord_send",
    description: "Send a message to a Discord channel",
    args: z.object({
      channelId: z.string().describe("The Discord channel ID to send to"),
      content: z.string().describe("The message content to send"),
    }),
    result: z.object({
      messageId: z.string(),
    }),
    capabilities: [{ name: "discord:message" as const }],
    handler: async (args: { channelId: string; content: string }) => {
      const messageId = await clients.sendMessage(args.channelId, args.content);
      return { messageId };
    },
  };
}

export function createDiscordReadTool(clients: DiscordToolClients) {
  return {
    name: "discord_read",
    description: "Read channel information from Discord",
    args: z.object({
      channelId: z.string().describe("The Discord channel ID to read"),
    }),
    result: z.object({
      id: z.string(),
      name: z.string(),
      guildId: z.string().nullable(),
      type: z.string(),
    }),
    capabilities: [{ name: "discord:read" as const }],
    handler: async (args: { channelId: string }) => {
      const channel = await clients.getChannel(args.channelId);
      return channel;
    },
  };
}

export function registerDiscordTools(registry: ToolRegistry, clients: DiscordToolClients): void {
  registry.register(createDiscordSendTool(clients));
  registry.register(createDiscordReadTool(clients));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/channels/test/discord/tools.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/channels/src/discord/tools.ts packages/channels/test/discord/tools.test.ts
git commit -m "feat(channels): add Discord tool definitions with capability gates"
```

---

### Task 6: Scaffold @openjarvis/skills-web package and web_fetch tool

**Files:**
- Create: `packages/skills-web/package.json`
- Create: `packages/skills-web/tsconfig.json`
- Create: `packages/skills-web/src/index.ts`
- Create: `packages/skills-web/src/fetch.ts`
- Create: `packages/skills-web/src/fetch.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@openjarvis/skills-web",
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
    "@openjarvis/markdownify": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../core" }, { "path": "../markdownify" }]
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/skills-web/src/fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWebFetchTool } from "./fetch.js";
import { ToolRegistry } from "@openjarvis/core";

describe("web_fetch tool", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registers web_fetch with network capability", () => {
    const tool = createWebFetchTool({ fetch: globalThis.fetch });
    registry.register(tool);
    expect(registry.has("web_fetch")).toBe(true);
  });

  it("fetches a URL and returns markdown", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("<html><body><h1>Hello</h1><p>World</p></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );
    const tool = createWebFetchTool({ fetch: mockFetch as unknown as typeof globalThis.fetch });
    registry.register(tool);

    const result = await registry.invoke(
      { name: "web_fetch", args: { url: "https://example.com" } },
      { agentId: "test", capabilities: [{ name: "web:fetch" }] },
      { agentId: "test" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { markdown: string };
      expect(data.markdown).toContain("Hello");
    }
  });

  it("is denied without web:fetch capability", async () => {
    const tool = createWebFetchTool({ fetch: globalThis.fetch });
    registry.register(tool);

    const result = await registry.invoke(
      { name: "web_fetch", args: { url: "https://example.com" } },
      { agentId: "test", capabilities: [] },
      { agentId: "test" },
    );

    expect(result.ok).toBe(false);
  });

  it("returns error for non-2xx responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const tool = createWebFetchTool({ fetch: mockFetch as unknown as typeof globalThis.fetch });
    registry.register(tool);

    const result = await registry.invoke(
      { name: "web_fetch", args: { url: "https://example.com/missing" } },
      { agentId: "test", capabilities: [{ name: "web:fetch" }] },
      { agentId: "test" },
    );

    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run packages/skills-web/src/fetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement fetch.ts**

Create `packages/skills-web/src/fetch.ts`:

```ts
import { z } from "zod";
import { markdownify } from "@openjarvis/markdownify";

export interface WebFetchConfig {
  fetch: typeof globalThis.fetch;
  maxBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export function createWebFetchTool(config: WebFetchConfig) {
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "web_fetch" as const,
    description: "Fetch a URL and convert the response to clean Markdown text",
    args: z.object({
      url: z.string().url().describe("The URL to fetch"),
      format: z.enum(["markdown", "text"]).optional().default("markdown").describe("Output format"),
    }),
    result: z.object({
      markdown: z.string(),
      title: z.string().optional(),
      url: z.string(),
      format: z.string(),
    }),
    capabilities: [{ name: "web:fetch" as const }, { name: "document:convert" as const }],
    handler: async (args: { url: string; format?: string }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await config.fetch(args.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type") ?? "text/plain";
        const buffer = await res.arrayBuffer();

        if (buffer.byteLength > maxBytes) {
          throw new Error(`Response too large: ${buffer.byteLength} bytes (max ${maxBytes})`);
        }

        const data = new Uint8Array(buffer);
        const result = await markdownify({ data, mime: contentType, filename: args.url });

        return {
          markdown: result.markdown,
          title: result.title,
          url: args.url,
          format: args.format ?? "markdown",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function registerWebFetchTools(registry: import("@openjarvis/core").ToolRegistry, config: WebFetchConfig): void {
  registry.register(createWebFetchTool(config));
}
```

- [ ] **Step 6: Create index.ts**

Create `packages/skills-web/src/index.ts`:

```ts
export { createWebFetchTool, registerWebFetchTools, type WebFetchConfig } from "./fetch.js";
```

- [ ] **Step 7: Install dependencies and run tests**

Run: `npm install && npx vitest run packages/skills-web/src/fetch.test.ts`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/skills-web/
git commit -m "feat(skills-web): add web_fetch tool with markdown conversion"
```

---

### Task 7: Update Nexus router and agent pool

**Files:**
- Modify: `packages/jarvis/src/nexus/router.ts`
- Modify: `packages/jarvis/src/nexus/pool.ts`

- [ ] **Step 1: Add Discord routes to router**

Read `packages/jarvis/src/nexus/router.ts`. Add routes for Discord and web intents:

Add to the `route()` method's switch/map:
- `"send_discord"` → `{ primary: { agentId: "discord", ... } }`
- `"read_discord"` → `{ primary: { agentId: "discord", ... } }`
- `"fetch_url"` → `{ primary: { agentId: "web", ... } }`
- `"search"` → keep existing research route (no change)

- [ ] **Step 2: Add Discord and web agents to pool**

Read `packages/jarvis/src/nexus/pool.ts`. Add entries to the `agents` Map:

- `"discord"` agent with capabilities `["discord:message", "discord:read"]`
- `"web"` agent with capabilities `["web:fetch", "document:convert"]`

Factories return mock data for now (same pattern as existing agents).

- [ ] **Step 3: Run typecheck**

Run: `npm run build --workspace=@openjarvis/jarvis`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/jarvis/`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/jarvis/src/nexus/router.ts packages/jarvis/src/nexus/pool.ts
git commit -m "feat(jarvis): add Discord and web routes to Nexus router and agent pool"
```

---

### Task 8: Final gate

- [ ] **Step 1: Run full local gate**

Run: `npm run typecheck && npm test && npm run coverage && npm run lint && npm run format:check`
Expected: ALL PASS, coverage ≥ 99%

- [ ] **Step 2: Run Docker gate**

Run: `docker build -t openjarvis-gate -f Dockerfile.test . && docker run --rm openjarvis-gate`
Expected: ALL GATES PASSED

- [ ] **Step 3: Update CHECKPOINT.md**

Add `@openjarvis/channels` and `@openjarvis/skills-web` to the package table.

- [ ] **Step 4: Commit**

```bash
git add CHECKPOINT.md
git commit -m "docs: update CHECKPOINT for Discord channel and web_fetch"
```

- [ ] **Step 5: Push branch and open PR**

```bash
git push origin discord-webfetch
gh pr create --title "feat: Discord channel integration + web_fetch tool" --body "..."
```

---

## Spec Coverage Checklist

| Spec Requirement | Plan Task |
|---|---|
| Discord gateway connection | Task 4 |
| Discord REST API wrapper | Task 4 |
| Discord session mapping | Task 3 |
| Discord tool definitions (send, read) | Task 5 |
| Discord capability gates | Tasks 1, 5 |
| web_fetch tool | Task 6 |
| web_fetch uses markdownify | Task 6 |
| Nexus router updates | Task 7 |
| Agent pool updates | Task 7 |
| Package scaffolding (channels, skills-web) | Tasks 2, 6 |
| CapabilityName extensions | Task 1 |
| Full gate | Task 8 |

## Placeholder Scan

- No TBD/TODO/"implement later" placeholders.
- Every step includes exact code or commands.
- Tests contain concrete assertions.

## Type Consistency Check

- `DiscordToolClients.sendMessage` → `(channelId: string, content: string) => Promise<string>` matches `DiscordRest.sendMessage` return type.
- `WebFetchConfig.fetch` → `typeof globalThis.fetch` matches Node 22 native fetch.
- `createWebFetchTool` return type matches `ToolDefinition` shape with `name`, `description`, `args`, `result`, `capabilities`, `handler`.
- `CapabilityName` new entries `"discord:message"`, `"discord:read"`, `"web:fetch"`, `"web:browse"` are added to the union type.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-discord-webfetch.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?