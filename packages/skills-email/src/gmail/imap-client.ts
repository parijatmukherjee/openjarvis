import { ImapFlow } from "imapflow";
import type { FetchMessageObject } from "imapflow";
import type { EmailFolder, EmailMessage, ListOptions } from "../types.js";

export interface GmailImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export class GmailImapClient {
  private client: ImapFlow;
  private connected = false;

  constructor(config: GmailImapConfig, client: ImapFlow) {
    this.client = client;
    void config;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    await this.client.connect();
    this.connected = true;
  }

  async listFolders(): Promise<EmailFolder[]> {
    try {
      await this.ensureConnected();
      const mailboxes = await this.client.list();
      return mailboxes.map((mb) => ({
        name: mb.name,
        path: mb.path,
        delimiter: mb.delimiter,
      }));
    } catch {
      return [];
    }
  }

  async listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]> {
    try {
      await this.ensureConnected();
      const lock = await this.client.getMailboxLock(folder);
      try {
        const limit = opts?.limit ?? 20;
        const searchQuery: Record<string, unknown> = {};
        if (opts?.unreadOnly) {
          searchQuery.unseen = true;
        }
        const uids = await this.client.search(searchQuery);
        if (!uids || uids.length === 0) return [];

        const limitedUids = uids.slice(0, limit);
        const range = limitedUids.join(",");
        const messages = await this.client.fetchAll(range, {
          envelope: true,
          flags: true,
          uid: true,
        });

        return messages.map((msg) => this.mapMessage(msg, folder));
      } finally {
        lock.release();
      }
    } catch {
      return [];
    }
  }

  async getMessage(uid: string): Promise<EmailMessage | null> {
    try {
      await this.ensureConnected();
      const lock = await this.client.getMailboxLock("INBOX");
      try {
        const msg = await this.client.fetchOne(uid, {
          envelope: true,
          flags: true,
          uid: true,
          source: true,
        });
        if (!msg) return null;
        return this.mapMessage(msg, "INBOX");
      } finally {
        lock.release();
      }
    } catch {
      return null;
    }
  }

  async search(query: string): Promise<EmailMessage[]> {
    try {
      await this.ensureConnected();
      const lock = await this.client.getMailboxLock("INBOX");
      try {
        const searchObj = this.parseSearchQuery(query);
        const uids = await this.client.search(searchObj);
        if (!uids || uids.length === 0) return [];

        const range = uids.join(",");
        const messages = await this.client.fetchAll(range, {
          envelope: true,
          flags: true,
          uid: true,
        });

        return messages.map((msg) => this.mapMessage(msg, "INBOX"));
      } finally {
        lock.release();
      }
    } catch {
      return [];
    }
  }

  private mapMessage(msg: FetchMessageObject, folder: string): EmailMessage {
    const envelope = (msg.envelope ?? {}) as Record<string, unknown>;
    const fromArr = (envelope.from ?? []) as Array<{
      name?: string;
      address?: string;
    }>;
    const toArr = (envelope.to ?? []) as Array<{
      name?: string;
      address?: string;
    }>;
    const ccArr = (envelope.cc ?? []) as Array<{
      name?: string;
      address?: string;
    }>;

    const from = fromArr[0] ?? { name: "", address: "" };
    const flags = msg.flags instanceof Set ? Array.from(msg.flags as Set<string>) : [];
    const dateVal = envelope.date;
    const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal ?? "");

    return {
      id: String(msg.uid ?? msg.seq ?? ""),
      from: { name: from.name ?? "", address: from.address ?? "" },
      to: toArr.map((a) => ({
        name: a.name ?? "",
        address: a.address ?? "",
      })),
      cc: ccArr.map((a) => ({
        name: a.name ?? "",
        address: a.address ?? "",
      })),
      subject: String(envelope.subject ?? ""),
      body: "",
      date: dateStr,
      attachments: [],
      folder,
      flags,
    };
  }

  private parseSearchQuery(query: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const tokens = query.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const colonIdx = token.indexOf(":");
      if (colonIdx === -1) {
        result.text = token;
        continue;
      }
      const key = token.slice(0, colonIdx).toLowerCase();
      const val = token.slice(colonIdx + 1);
      switch (key) {
        case "from":
          result.from = val;
          break;
        case "to":
          result.to = val;
          break;
        case "subject":
          result.subject = val;
          break;
        case "cc":
          result.cc = val;
          break;
        case "body":
          result.body = val;
          break;
        default:
          result[key] = val;
      }
    }
    return result;
  }
}
