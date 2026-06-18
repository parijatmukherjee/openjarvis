import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphEmailClient } from "../../src/graph/graph-client.js";
import type { EmailMessage, EmailDraft } from "../../src/types.js";

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

    it("handles message with null subject and body", async () => {
      const nullMsg = {
        id: "msg-2",
        subject: null,
        body: null,
        from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
        toRecipients: null,
        ccRecipients: null,
        receivedDateTime: "2026-06-17T12:00:00Z",
        parentFolderId: "inbox",
        isRead: false,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nullMsg,
      });

      const client = createClient();
      const msg = await client.getMessage("msg-2");
      expect(msg.subject).toBe("");
      expect(msg.body).toBe("");
      expect(msg.flags).toEqual([]);
      expect(msg.to).toEqual([]);
      expect(msg.cc).toEqual([]);
    });

    it("handles message with null subject and body and null from", async () => {
      const nullFromMsg = {
        id: "msg-3",
        subject: "No From",
        body: { content: "hello", contentType: "text" },
        from: null,
        toRecipients: [{ emailAddress: { name: "Bob", address: "bob@example.com" } }],
        ccRecipients: [],
        receivedDateTime: "2026-06-17T12:00:00Z",
        parentFolderId: "inbox",
        isRead: true,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nullFromMsg,
      });

      const client = createClient();
      const msg = await client.getMessage("msg-3");
      expect(msg.from).toEqual({ name: "", address: "" });
    });

    it("handles message without subject and body fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "msg-nofields",
          subject: undefined,
          body: undefined,
          from: { emailAddress: { name: "A", address: "a@b.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: undefined,
          parentFolderId: undefined,
          isRead: undefined,
        }),
      });

      const client = createClient();
      const msg = await client.getMessage("msg-nofields");
      expect(msg.subject).toBe("");
      expect(msg.body).toBe("");
      expect(msg.date).toBe("");
      expect(msg.folder).toBe("");
      expect(msg.flags).toEqual([]);
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

    it("sends HTML body when htmlBody is provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "HTML Test",
        body: "Plain text",
        htmlBody: "<p>HTML content</p>",
        cc: [{ name: "Carol", address: "carol@example.com" }],
      };

      const client = createClient();
      await client.send(draft);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.message.body.contentType).toBe("html");
      expect(callBody.message.body.content).toBe("<p>HTML content</p>");
      expect(callBody.message.ccRecipients).toEqual([
        { emailAddress: { name: "Carol", address: "carol@example.com" } },
      ]);
    });

    it("throws on send failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ error: { message: "Cannot send" } }),
      });

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Test",
        body: "Hello",
      };

      const client = createClient();
      await expect(client.send(draft)).rejects.toThrow("Graph API 403");
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

    it("retries on 429 without Retry-After header (default 1s)", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => null },
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ id: "inbox", displayName: "Inbox" }] }),
        });

      const client = createClient();
      const promise = client.listFolders();

      await vi.advanceTimersByTimeAsync(1500);
      const folders = await promise;

      expect(folders).toHaveLength(1);

      vi.useRealTimers();
    });

    it("throws after max retries exceeded for 429", async () => {
      const rateLimitedResponse = {
        ok: false,
        status: 429,
        headers: { get: () => "0" },
        json: async () => ({}),
      };

      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse);

      const client = createClient();
      await expect(client.listFolders()).rejects.toThrow("Max retries exceeded for 429");
    });

    it("handles API error without error.message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      });

      const client = createClient();
      await expect(client.listFolders()).rejects.toThrow("Graph API 500: Internal Server Error");
    });

    it("handles folder without unreadItemCount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "inbox", displayName: "Inbox" }],
        }),
      });

      const client = createClient();
      const folders = await client.listFolders();
      expect(folders[0]).toEqual({ name: "Inbox", path: "inbox", delimiter: "/" });
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
