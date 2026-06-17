import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphEmailClient } from "../../src/graph/graph-client.js";
import type { EmailFolder, EmailMessage, EmailDraft } from "../../src/types.js";

const mockGetToken = vi.fn<() => Promise<string>>().mockResolvedValue("tok-123");
const mockFetch = vi.fn();

function createClient(): GraphEmailClient {
  return new GraphEmailClient({ getToken: mockGetToken, fetch: mockFetch });
}

const graphMessage = {
  id: "msg-1",
  subject: "Hello",
  body: { content: "Hi there", contentType: "text" },
  from: {
    emailAddress: { name: "Alice", address: "alice@example.com" },
  },
  toRecipients: [{ emailAddress: { name: "Bob", address: "bob@example.com" } }],
  ccRecipients: [],
  receivedDateTime: "2026-06-17T12:00:00Z",
  hasAttachments: false,
  parentFolderId: "inbox",
  isRead: true,
  flag: { flagStatus: "notFlagged" },
};

const expectedMessage: EmailMessage = {
  id: "msg-1",
  from: { name: "Alice", address: "alice@example.com" },
  to: [{ name: "Bob", address: "bob@example.com" }],
  cc: [],
  subject: "Hello",
  body: "Hi there",
  date: "2026-06-17T12:00:00Z",
  attachments: [],
  folder: "inbox",
  flags: ["\\Seen"],
};

describe("GraphEmailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("tok-123");
  });

  describe("listFolders", () => {
    it("calls Graph API and maps to EmailFolder[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "inbox", displayName: "Inbox", unreadItemCount: 5 },
            { id: "sent", displayName: "Sent Items", unreadItemCount: 0 },
          ],
        }),
      });

      const client = createClient();
      const folders = await client.listFolders();

      expect(folders).toEqual([
        { name: "Inbox", path: "inbox", delimiter: "/", unreadCount: 5 },
        { name: "Sent Items", path: "sent", delimiter: "/", unreadCount: 0 },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/mailFolders",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer tok-123" }),
        }),
      );
    });
  });

  describe("listMessages", () => {
    it("calls Graph API and maps to EmailMessage[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [graphMessage] }),
      });

      const client = createClient();
      const messages = await client.listMessages("inbox", { limit: 10 });

      expect(messages).toEqual([expectedMessage]);
    });
  });

  describe("getMessage", () => {
    it("fetches a single message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => graphMessage,
      });

      const client = createClient();
      const msg = await client.getMessage("msg-1");

      expect(msg).toEqual(expectedMessage);
    });
  });

  describe("send", () => {
    it("posts to Graph sendMail endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Test",
        body: "Hello",
      };

      const client = createClient();
      const id = await client.send(draft);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(typeof id).toBe("string");
    });
  });

  describe("search", () => {
    it("calls Graph search endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [graphMessage] }),
      });

      const client = createClient();
      const results = await client.search("hello");

      expect(results).toEqual([expectedMessage]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("me/messages?$search="),
        expect.anything(),
      );
    });
  });

  describe("error handling", () => {
    it("handles Graph API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ error: { message: "Insufficient privileges" } }),
      });

      const client = createClient();
      await expect(client.listFolders()).rejects.toThrow();
    });

    it("retries on 429 with Retry-After header", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => "1" },
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [] }),
        });

      const client = createClient();
      const promise = client.listFolders();

      await vi.advanceTimersByTimeAsync(1500);
      const folders = await promise;

      expect(folders).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("stub methods", () => {
    it("startDeviceCodeAuth throws", async () => {
      const client = createClient();
      await expect(client.startDeviceCodeAuth()).rejects.toThrow("Use GraphOAuth instead");
    });

    it("waitForAuth throws", async () => {
      const client = createClient();
      await expect(client.waitForAuth("dc")).rejects.toThrow("Use GraphOAuth instead");
    });

    it("refreshToken throws", async () => {
      const client = createClient();
      await expect(client.refreshToken()).rejects.toThrow("Use GraphOAuth instead");
    });
  });
});
