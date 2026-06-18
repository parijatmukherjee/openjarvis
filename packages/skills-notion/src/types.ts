export interface NotionPage {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

export interface NotionQueryResult {
  results: NotionPage[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface NotionCreateInput {
  databaseId: string;
  title: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
}

export interface NotionUpdateInput {
  pageId: string;
  properties: Record<string, unknown>;
  archived?: boolean;
}

export interface NotionConfig {
  token?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}