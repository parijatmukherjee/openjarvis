import { describe, it, expect, vi } from "vitest";
import { GmailImapClient } from "../../src/gmail/imap-client.js";
import type { GmailImapConfig } from "../../src/gmail/imap-client.js";
import type { EmailFolder, EmailMessage } from "../../src/types.js";

function createMockClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    getMailboxLock: vi.fn().mockResolvedValue({ path: "INBOX", release: vi.fn() }),
    search: vi.fn().mockResolvedValue([]),
    fetchAll: vi.fn().mockResolvedValue([]),
    fetchOne: vi.fn().mockResolvedValue(false),
    mailboxOpen: vi.fn().mockResolvedValue({}),
  };
}

function makeConfig(): GmailImapConfig {
  return { host: "imap.gmail.com", port: 993, user: "test@gmail.com", password: "pass" };
}

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date("2026-06-17T00:00:00.000Z"),
    subject: "Hello",
    from: [{ name: "Alice", address: "alice@example.com" }],
    to: [{ name: "Bob", address: "bob@example.com" }],
    cc: [],
    ...overrides,
  };
}

describe("GmailImapClient", () => {
  describe("listFolders", () => {
    it("returns mapped EmailFolder[]", async () => {
      const mock = createMockClient();
      mock.list.mockResolvedValue([
        {
          path: "INBOX",
          name: "INBOX",
          delimiter: ".",
          flags: new Set(),
          listed: true,
          subscribed: true,
        },
        {
          path: "Sent",
          name: "Sent",
          delimiter: ".",
          flags: new Set(),
          listed: true,
          subscribed: true,
        },
      ]);
      const client = new GmailImapClient(makeConfig(), mock as any);
      const folders: EmailFolder[] = await client.listFolders();

      expect(folders).toHaveLength(2);
      expect(folders[0]).toEqual({ name: "INBOX", path: "INBOX", delimiter: "." });
      expect(folders[1]).toEqual({ name: "Sent", path: "Sent", delimiter: "." });
    });
  });

  describe("listMessages", () => {
    it("fetches envelopes and maps to EmailMessage", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.search.mockResolvedValue([1, 2]);
      mock.fetchAll.mockResolvedValue([
        {
          uid: 1,
          seq: 1,
          envelope: makeEnvelope({ subject: "Sub 1" }),
          flags: new Set(["\\Seen"]),
        },
        { uid: 2, seq: 2, envelope: makeEnvelope({ subject: "Sub 2" }), flags: new Set() },
      ]);
      const client = new GmailImapClient(makeConfig(), mock as any);
      const msgs: EmailMessage[] = await client.listMessages("INBOX");

      expect(msgs).toHaveLength(2);
      expect(msgs[0].subject).toBe("Sub 1");
      expect(msgs[1].subject).toBe("Sub 2");
      expect(lock.release).toHaveBeenCalled();
    });

    it("returns empty array when search returns no UIDs", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.search.mockResolvedValue([]);
      const client = new GmailImapClient(makeConfig(), mock as any);
      const msgs = await client.listMessages("INBOX");
      expect(msgs).toEqual([]);
    });

    it("passes unreadOnly to search query", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.search.mockResolvedValue([1]);
      mock.fetchAll.mockResolvedValue([
        { uid: 1, seq: 1, envelope: makeEnvelope(), flags: new Set() },
      ]);
      const client = new GmailImapClient(makeConfig(), mock as any);
      await client.listMessages("INBOX", { unreadOnly: true });
      expect(mock.search).toHaveBeenCalledWith({ unseen: true });
    });
  });

  describe("search", () => {
    it("delegates to imapflow search and returns messages", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.search.mockResolvedValue([10]);
      mock.fetchAll.mockResolvedValue([
        { uid: 10, seq: 10, envelope: makeEnvelope({ subject: "Match" }), flags: new Set() },
      ]);
      const client = new GmailImapClient(makeConfig(), mock as any);
      const results: EmailMessage[] = await client.search("from:alice subject:test");

      expect(results).toHaveLength(1);
      expect(results[0].subject).toBe("Match");
      expect(mock.search).toHaveBeenCalledWith({ from: "alice", subject: "test" });
      expect(lock.release).toHaveBeenCalled();
    });
  });

  describe("getMessage", () => {
    it("fetches a single message by uid", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.fetchOne.mockResolvedValue({
        uid: 42,
        seq: 5,
        envelope: makeEnvelope({ subject: "Single" }),
        flags: new Set(["\\Seen"]),
      });
      const client = new GmailImapClient(makeConfig(), mock as any);
      const msg: EmailMessage | null = await client.getMessage("42");

      expect(msg).not.toBeNull();
      expect(msg!.subject).toBe("Single");
      expect(msg!.id).toBe("42");
      expect(lock.release).toHaveBeenCalled();
    });

    it("returns null when message not found", async () => {
      const mock = createMockClient();
      const lock = { path: "INBOX", release: vi.fn() };
      mock.getMailboxLock.mockResolvedValue(lock);
      mock.fetchOne.mockResolvedValue(false);
      const client = new GmailImapClient(makeConfig(), mock as any);
      const msg = await client.getMessage("9999");
      expect(msg).toBeNull();
    });
  });

  describe("lazy connection", () => {
    it("connects lazily on first operation and only once", async () => {
      const mock = createMockClient();
      mock.list.mockResolvedValue([]);
      const client = new GmailImapClient(makeConfig(), mock as any);

      expect(mock.connect).not.toHaveBeenCalled();
      await client.listFolders();
      expect(mock.connect).toHaveBeenCalledTimes(1);

      await client.listFolders();
      expect(mock.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("surfaces errors without throwing", async () => {
      const mock = createMockClient();
      mock.connect.mockRejectedValue(new Error("Connection refused"));
      const client = new GmailImapClient(makeConfig(), mock as any);
      const folders = await client.listFolders();
      expect(folders).toEqual([]);
    });

    it("returns null on getMessage error", async () => {
      const mock = createMockClient();
      mock.getMailboxLock.mockRejectedValue(new Error("Lock failed"));
      const client = new GmailImapClient(makeConfig(), mock as any);
      const msg = await client.getMessage("1");
      expect(msg).toBeNull();
    });

    it("returns empty array on search error", async () => {
      const mock = createMockClient();
      mock.getMailboxLock.mockRejectedValue(new Error("Lock failed"));
      const client = new GmailImapClient(makeConfig(), mock as any);
      const results = await client.search("from:test");
      expect(results).toEqual([]);
    });
  });
});
