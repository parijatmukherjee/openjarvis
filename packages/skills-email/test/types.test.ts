import { describe, it, expect } from "vitest";
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
