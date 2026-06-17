import { describe, it, expect, vi } from "vitest";
import { GmailEmailClient } from "../../src/gmail/client.js";
import type { EmailFolder, EmailMessage, EmailDraft } from "../../src/types.js";

function createMockImap() {
  return {
    listFolders: vi.fn<() => Promise<EmailFolder[]>>().mockResolvedValue([]),
    listMessages: vi.fn<(folder: string) => Promise<EmailMessage[]>>().mockResolvedValue([]),
    getMessage: vi.fn<(id: string) => Promise<EmailMessage | null>>().mockResolvedValue(null),
    search: vi.fn<(query: string) => Promise<EmailMessage[]>>().mockResolvedValue([]),
  };
}

function createMockSmtp() {
  return {
    send: vi.fn<(draft: EmailDraft) => Promise<string>>().mockResolvedValue("msg-id"),
  };
}

describe("GmailEmailClient", () => {
  describe("listFolders", () => {
    it("delegates listFolders to imap client", async () => {
      const imap = createMockImap();
      const smtp = createMockSmtp();
      const folders: EmailFolder[] = [
        { name: "INBOX", path: "INBOX", delimiter: "." },
      ];
      imap.listFolders.mockResolvedValue(folders);

      const client = new GmailEmailClient(imap as any, smtp as any);
      const result = await client.listFolders();

      expect(imap.listFolders).toHaveBeenCalledOnce();
      expect(result).toEqual(folders);
    });
  });

  describe("listMessages", () => {
    it("delegates listMessages to imap client", async () => {
      const imap = createMockImap();
      const smtp = createMockSmtp();
      const messages: EmailMessage[] = [
        { id: "1", from: { name: "A", address: "a@test.com" }, to: [], cc: [], subject: "Hi", body: "", date: "", attachments: [], folder: "INBOX", flags: [] },
      ];
      imap.listMessages.mockResolvedValue(messages);

      const client = new GmailEmailClient(imap as any, smtp as any);
      const result = await client.listMessages("INBOX", { limit: 10 });

      expect(imap.listMessages).toHaveBeenCalledWith("INBOX", { limit: 10 });
      expect(result).toEqual(messages);
    });
  });

  describe("getMessage", () => {
    it("delegates getMessage to imap client", async () => {
      const imap = createMockImap();
      const smtp = createMockSmtp();
      const message: EmailMessage = {
        id: "42", from: { name: "A", address: "a@test.com" }, to: [], cc: [], subject: "Hello", body: "", date: "", attachments: [], folder: "INBOX", flags: [],
      };
      imap.getMessage.mockResolvedValue(message);

      const client = new GmailEmailClient(imap as any, smtp as any);
      const result = await client.getMessage("42");

      expect(imap.getMessage).toHaveBeenCalledWith("42");
      expect(result).toEqual(message);
    });
  });

  describe("send", () => {
    it("delegates send to smtp sender", async () => {
      const imap = createMockImap();
      const smtp = createMockSmtp();
      smtp.send.mockResolvedValue("sent-msg-123");

      const draft: EmailDraft = {
        to: [{ address: "bob@test.com" }],
        subject: "Test",
        body: "Hello",
      };

      const client = new GmailEmailClient(imap as any, smtp as any);
      const result = await client.send(draft);

      expect(smtp.send).toHaveBeenCalledWith(draft);
      expect(result).toBe("sent-msg-123");
    });
  });

  describe("search", () => {
    it("delegates search to imap client", async () => {
      const imap = createMockImap();
      const smtp = createMockSmtp();
      const results: EmailMessage[] = [
        { id: "5", from: { name: "B", address: "b@test.com" }, to: [], cc: [], subject: "Match", body: "", date: "", attachments: [], folder: "INBOX", flags: [] },
      ];
      imap.search.mockResolvedValue(results);

      const client = new GmailEmailClient(imap as any, smtp as any);
      const result = await client.search("from:bob");

      expect(imap.search).toHaveBeenCalledWith("from:bob");
      expect(result).toEqual(results);
    });
  });
});