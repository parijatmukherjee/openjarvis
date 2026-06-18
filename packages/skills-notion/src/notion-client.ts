import type { NotionConfig, NotionPage, NotionQueryResult, NotionCreateInput, NotionUpdateInput } from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DEFAULT_TIMEOUT_MS = 30_000;

export class NotionClient {
  private readonly token: string;
  private readonly doFetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(config: NotionConfig = {}) {
    this.token = config.token ?? process.env.NOTION_TOKEN ?? "";
    this.doFetch = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async queryDatabase(
    databaseId: string,
    filter?: string,
    sorts?: string,
    limit?: number,
  ): Promise<NotionQueryResult> {
    const body: Record<string, unknown> = {};
    if (filter !== undefined) {
      body.filter = JSON.parse(filter);
    }
    if (sorts !== undefined) {
      body.sorts = JSON.parse(sorts);
    }
    if (limit !== undefined) {
      body.page_size = limit;
    }

    const response = await this.request("POST", `/databases/${databaseId}/query`, body);
    return this.mapQueryResult(response);
  }

  async getPage(pageId: string): Promise<NotionPage> {
    const response = await this.request("GET", `/pages/${pageId}`);
    return this.mapPage(response);
  }

  async createPage(input: NotionCreateInput): Promise<NotionPage> {
    const body: Record<string, unknown> = {
      parent: { database_id: input.databaseId },
      properties: {
        Name: { title: [{ text: { content: input.title } }] },
        ...(input.properties ?? {}),
      },
    };
    if (input.children !== undefined) {
      body.children = input.children;
    }

    const response = await this.request("POST", "/pages", body);
    return this.mapPage(response);
  }

  async updatePage(input: NotionUpdateInput): Promise<NotionPage> {
    const body: Record<string, unknown> = { properties: input.properties };
    if (input.archived !== undefined) {
      body.archived = input.archived;
    }

    const response = await this.request("PATCH", `/pages/${input.pageId}`, body);
    return this.mapPage(response);
  }

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const response = await this.doFetch(`${NOTION_API_BASE}${path}`, init);

      if (response.status === 401) {
        throw new Error("Notion API: unauthorized (invalid token)");
      }
      if (response.status === 404) {
        throw new Error("Notion API: not found");
      }
      if (response.status === 429) {
        throw new Error("Notion API: rate limited");
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Notion API: HTTP ${response.status} ${text}`);
      }

      return await response.json() as unknown;
    } finally {
      clearTimeout(timer);
    }
  }

  private mapPage(raw: unknown): NotionPage {
    const r = raw as Record<string, unknown>;
    const props = (r.properties ?? {}) as Record<string, unknown>;
    const titleProp = props["Name"] ?? props["name"] ?? props["title"];
    let title = "";
    if (titleProp !== undefined && titleProp !== null) {
      const tp = titleProp as Record<string, unknown>;
      if (Array.isArray(tp.title)) {
        title = (tp.title as Array<Record<string, unknown>>)
          .map((t) => (t.plain_text ?? "") as string)
          .join("");
      }
    }
    return {
      id: r.id as string,
      title,
      url: r.url as string,
      createdTime: r.created_time as string,
      lastEditedTime: r.last_edited_time as string,
      properties: props,
    };
  }

  private mapQueryResult(raw: unknown): NotionQueryResult {
    const r = raw as Record<string, unknown>;
    return {
      results: Array.isArray(r.results) ? r.results.map((p: unknown) => this.mapPage(p)) : [],
      hasMore: r.has_more as boolean,
      ...(r.next_cursor !== undefined && r.next_cursor !== null ? { nextCursor: r.next_cursor as string } : {}),
    };
  }
}