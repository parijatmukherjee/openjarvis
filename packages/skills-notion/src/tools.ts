import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import { NotionClient } from "./notion-client.js";
import type { NotionConfig, NotionPage } from "./types.js";

const NotionQueryArgs = z.object({
  databaseId: z.string(),
  filter: z.string().optional(),
  sorts: z.string().optional(),
  limit: z.number().optional(),
});

const NotionQueryResult = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      createdTime: z.string(),
      lastEditedTime: z.string(),
      properties: z.record(z.unknown()),
    }),
  ),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

type NotionQueryArgs = z.infer<typeof NotionQueryArgs>;
type NotionQueryResult = z.infer<typeof NotionQueryResult>;

export function createNotionQueryTool(
  config: NotionConfig = {},
): ToolDefinition<NotionQueryArgs, NotionQueryResult> {
  const client = new NotionClient(config);
  return {
    name: "notion_query",
    description: "Query a Notion database",
    args: NotionQueryArgs as unknown as z.ZodType<NotionQueryArgs>,
    result: NotionQueryResult as unknown as z.ZodType<NotionQueryResult>,
    capabilities: [{ name: "notion:read" as const }],
    handler: async (args) => {
      const result = await client.queryDatabase(
        args.databaseId,
        args.filter,
        args.sorts,
        args.limit,
      );
      return {
        results: result.results.map(mapPage),
        hasMore: result.hasMore,
        ...(result.nextCursor !== undefined ? { nextCursor: result.nextCursor } : {}),
      };
    },
  };
}

const NotionGetArgs = z.object({
  pageId: z.string(),
});

const NotionGetResult = z.object({
  page: z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    createdTime: z.string(),
    lastEditedTime: z.string(),
    properties: z.record(z.unknown()),
  }),
});

type NotionGetArgs = z.infer<typeof NotionGetArgs>;
type NotionGetResult = z.infer<typeof NotionGetResult>;

export function createNotionGetTool(
  config: NotionConfig = {},
): ToolDefinition<NotionGetArgs, NotionGetResult> {
  const client = new NotionClient(config);
  return {
    name: "notion_get",
    description: "Get a Notion page by ID",
    args: NotionGetArgs as unknown as z.ZodType<NotionGetArgs>,
    result: NotionGetResult as unknown as z.ZodType<NotionGetResult>,
    capabilities: [{ name: "notion:read" as const }],
    handler: async (args) => {
      const page = await client.getPage(args.pageId);
      return { page: mapPage(page) };
    },
  };
}

const NotionCreateArgs = z.object({
  databaseId: z.string(),
  title: z.string(),
  properties: z.record(z.unknown()).optional(),
});

const NotionCreateResult = z.object({
  pageId: z.string(),
  url: z.string(),
});

type NotionCreateArgs = z.infer<typeof NotionCreateArgs>;
type NotionCreateResult = z.infer<typeof NotionCreateResult>;

export function createNotionCreateTool(
  config: NotionConfig = {},
): ToolDefinition<NotionCreateArgs, NotionCreateResult> {
  const client = new NotionClient(config);
  return {
    name: "notion_create",
    description: "Create a page in a Notion database",
    args: NotionCreateArgs as unknown as z.ZodType<NotionCreateArgs>,
    result: NotionCreateResult as unknown as z.ZodType<NotionCreateResult>,
    capabilities: [{ name: "notion:write" as const }],
    handler: async (args) => {
      const page = await client.createPage({
        databaseId: args.databaseId,
        title: args.title,
        ...(args.properties !== undefined ? { properties: args.properties } : {}),
      });
      return { pageId: page.id, url: page.url };
    },
  };
}

const NotionUpdateArgs = z.object({
  pageId: z.string(),
  properties: z.record(z.unknown()),
  archived: z.boolean().optional(),
});

const NotionUpdateResult = z.object({
  pageId: z.string(),
});

type NotionUpdateArgs = z.infer<typeof NotionUpdateArgs>;
type NotionUpdateResult = z.infer<typeof NotionUpdateResult>;

export function createNotionUpdateTool(
  config: NotionConfig = {},
): ToolDefinition<NotionUpdateArgs, NotionUpdateResult> {
  const client = new NotionClient(config);
  return {
    name: "notion_update",
    description: "Update a Notion page's properties",
    args: NotionUpdateArgs as unknown as z.ZodType<NotionUpdateArgs>,
    result: NotionUpdateResult as unknown as z.ZodType<NotionUpdateResult>,
    capabilities: [{ name: "notion:write" as const }],
    handler: async (args) => {
      await client.updatePage({
        pageId: args.pageId,
        properties: args.properties,
        ...(args.archived !== undefined ? { archived: args.archived } : {}),
      });
      return { pageId: args.pageId };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerNotionTools(
  registry: { register(tool: AnyToolDefinition): void },
  config: NotionConfig = {},
): void {
  registry.register(createNotionQueryTool(config));
  registry.register(createNotionGetTool(config));
  registry.register(createNotionCreateTool(config));
  registry.register(createNotionUpdateTool(config));
}

function mapPage(page: NotionPage) {
  return {
    id: page.id,
    title: page.title,
    url: page.url,
    createdTime: page.createdTime,
    lastEditedTime: page.lastEditedTime,
    properties: page.properties,
  };
}
