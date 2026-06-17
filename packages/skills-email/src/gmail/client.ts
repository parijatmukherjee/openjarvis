import type { EmailFolder, EmailMessage, EmailDraft, ListOptions } from "../types.js";
import type { GmailImapClient } from "./imap-client.js";
import type { GmailSmtpSender } from "./smtp-sender.js";

export class GmailEmailClient {
  private imap: GmailImapClient;
  private smtp: GmailSmtpSender;

  constructor(imap: GmailImapClient, smtp: GmailSmtpSender) {
    this.imap = imap;
    this.smtp = smtp;
  }

  async listFolders(): Promise<EmailFolder[]> {
    return this.imap.listFolders();
  }

  async listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]> {
    return this.imap.listMessages(folder, opts);
  }

  async getMessage(id: string): Promise<EmailMessage | null> {
    return this.imap.getMessage(id);
  }

  async send(draft: EmailDraft): Promise<string> {
    return this.smtp.send(draft);
  }

  async search(query: string): Promise<EmailMessage[]> {
    return this.imap.search(query);
  }
}