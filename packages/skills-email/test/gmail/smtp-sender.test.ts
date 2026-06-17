import { describe, it, expect, vi } from "vitest";
import { GmailSmtpSender } from "../../src/gmail/smtp-sender.js";
import type { GmailSmtpConfig } from "../../src/gmail/smtp-sender.js";
import type { EmailDraft } from "../../src/types.js";

function createMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: "<abc123@mail.gmail.com>" }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConfig(): GmailSmtpConfig {
  return { host: "smtp.gmail.com", port: 587, user: "test@gmail.com", password: "pass" };
}

describe("GmailSmtpSender", () => {
  describe("send", () => {
    it("sends a simple email and returns the messageId", async () => {
      const mock = createMockTransport();
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi Bob",
      };

      const id = await sender.send(draft);
      expect(id).toBe("abc123@mail.gmail.com");
      expect(mock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@gmail.com",
          to: ["bob@example.com"],
          subject: "Hello",
          text: "Hi Bob",
        }),
      );
    });

    it("includes cc addresses when provided", async () => {
      const mock = createMockTransport();
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        cc: [{ address: "carol@example.com" }],
        subject: "Hello",
        body: "Hi",
      };

      await sender.send(draft);
      expect(mock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ["carol@example.com"],
        }),
      );
    });

    it("sends html body when provided", async () => {
      const mock = createMockTransport();
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Plain text",
        htmlBody: "<p>HTML</p>",
      };

      await sender.send(draft);
      expect(mock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>HTML</p>",
        }),
      );
    });

    it("sends attachments when provided", async () => {
      const mock = createMockTransport();
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const content = new Uint8Array([1, 2, 3]);
      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "See attached",
        attachments: [{ filename: "file.pdf", contentType: "application/pdf", content }],
      };

      await sender.send(draft);
      expect(mock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              filename: "file.pdf",
              contentType: "application/pdf",
            }),
          ],
        }),
      );
      const call = mock.sendMail.mock.calls[0][0] as { attachments: Array<{ content: Buffer }> };
      expect(call.attachments[0].content).toBeInstanceOf(Buffer);
    });

    it("formats recipient names with addresses", async () => {
      const mock = createMockTransport();
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const draft: EmailDraft = {
        to: [{ name: "Bob Smith", address: "bob@example.com" }],
        cc: [{ name: "Carol", address: "carol@example.com" }],
        subject: "Hello",
        body: "Hi",
      };

      await sender.send(draft);
      expect(mock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['"Bob Smith" <bob@example.com>'],
          cc: ['"Carol" <carol@example.com>'],
        }),
      );
    });

    it("surfaces send errors", async () => {
      const mock = createMockTransport();
      mock.sendMail.mockRejectedValue(new Error("SMTP auth failed"));
      const sender = new GmailSmtpSender(makeConfig(), mock);

      const draft: EmailDraft = {
        to: [{ address: "bob@example.com" }],
        subject: "Hello",
        body: "Hi",
      };

      await expect(sender.send(draft)).rejects.toThrow("SMTP auth failed");
    });
  });
});
