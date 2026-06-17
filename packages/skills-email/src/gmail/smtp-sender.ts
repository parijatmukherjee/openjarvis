import type { EmailDraft } from "../types.js";

export interface GmailSmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface SmtpTransport {
  sendMail(mailOptions: Record<string, unknown>): Promise<{ messageId: string }>;
  close(): Promise<void>;
}

function formatAddress(addr: { name?: string; address: string }): string {
  if (addr.name) {
    return `"${addr.name}" <${addr.address}>`;
  }
  return addr.address;
}

export class GmailSmtpSender {
  private config: GmailSmtpConfig;
  private transport: SmtpTransport;

  constructor(config: GmailSmtpConfig, transport: SmtpTransport) {
    this.config = config;
    this.transport = transport;
  }

  async send(draft: EmailDraft): Promise<string> {
    const mailOptions: Record<string, unknown> = {
      from: this.config.user,
      to: draft.to.map(formatAddress),
      subject: draft.subject,
      text: draft.body,
    };

    if (draft.htmlBody) {
      mailOptions.html = draft.htmlBody;
    }

    if (draft.cc && draft.cc.length > 0) {
      mailOptions.cc = draft.cc.map(formatAddress);
    }

    if (draft.attachments && draft.attachments.length > 0) {
      mailOptions.attachments = draft.attachments.map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        content: Buffer.from(att.content),
      }));
    }

    const result = await this.transport.sendMail(mailOptions);
    return result.messageId.replace(/^<|>$/g, "");
  }
}
