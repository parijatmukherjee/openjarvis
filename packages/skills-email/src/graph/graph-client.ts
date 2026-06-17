import type {
  EmailFolder,
  EmailMessage,
  EmailDraft,
  ListOptions,
  DeviceCodeInfo,
  AuthResult,
} from "../types.js";

const BASE_URL = "https://graph.microsoft.com/v1.0";

export interface GraphClientDeps {
  getToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export class GraphEmailClient {
  private getToken: () => Promise<string>;
  private fetchImpl: typeof globalThis.fetch;

  constructor(deps: GraphClientDeps) {
    this.getToken = deps.getToken;
    this.fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async startDeviceCodeAuth(): Promise<DeviceCodeInfo> {
    throw new Error("Use GraphOAuth instead");
  }

  async waitForAuth(_deviceCode: string): Promise<AuthResult> {
    throw new Error("Use GraphOAuth instead");
  }

  async refreshToken(): Promise<AuthResult> {
    throw new Error("Use GraphOAuth instead");
  }

  private async graphGet(path: string): Promise<unknown> {
    const token = await this.getToken();
    const url = `${BASE_URL}${path}`;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        const msg = body?.error?.message ?? res.statusText;
        throw new Error(`Graph API ${res.status}: ${msg}`);
      }

      return res.json();
    }

    throw new Error("Max retries exceeded for 429");
  }

  private mapMessage(msg: Record<string, unknown>): EmailMessage {
    const from = (msg.from as Record<string, Record<string, string>>)?.emailAddress ?? {
      name: "",
      address: "",
    };
    const toRecipients = (
      (msg.toRecipients as Array<Record<string, Record<string, string>>>) ?? []
    ).map((r) => r.emailAddress);
    const ccRecipients = (
      (msg.ccRecipients as Array<Record<string, Record<string, string>>>) ?? []
    ).map((r) => r.emailAddress);

    const bodyObj = msg.body as { content?: string; contentType?: string } | undefined;

    return {
      id: msg.id as string,
      from: { name: from.name, address: from.address },
      to: toRecipients.map((r) => ({ name: r.name, address: r.address })),
      cc: ccRecipients.map((r) => ({ name: r.name, address: r.address })),
      subject: (msg.subject as string) ?? "",
      body: bodyObj?.content ?? "",
      date: (msg.receivedDateTime as string) ?? "",
      attachments: [],
      folder: (msg.parentFolderId as string) ?? "",
      flags: (msg.isRead as boolean) ? ["\\Seen"] : [],
    };
  }

  private buildSendMailBody(draft: EmailDraft): Record<string, unknown> {
    const message: Record<string, unknown> = {
      subject: draft.subject,
      body: {
        contentType: draft.htmlBody ? "html" : "text",
        content: draft.htmlBody ?? draft.body,
      },
      toRecipients: draft.to.map((r) => ({
        emailAddress: { name: r.name, address: r.address },
      })),
    };

    if (draft.cc) {
      message.ccRecipients = draft.cc.map((r) => ({
        emailAddress: { name: r.name, address: r.address },
      }));
    }

    return { message };
  }

  async listFolders(): Promise<EmailFolder[]> {
    const data = (await this.graphGet("/me/mailFolders")) as {
      value: Array<Record<string, unknown>>;
    };
    return data.value.map((f) => {
      const folder: EmailFolder = {
        name: f.displayName as string,
        path: f.id as string,
        delimiter: "/",
      };
      if (f.unreadItemCount !== undefined) {
        folder.unreadCount = f.unreadItemCount as number;
      }
      return folder;
    });
  }

  async listMessages(folder: string, opts?: ListOptions): Promise<EmailMessage[]> {
    const limit = opts?.limit ?? 20;
    const data = (await this.graphGet(`/me/mailFolders/${folder}/messages?$top=${limit}`)) as {
      value: Array<Record<string, unknown>>;
    };
    return data.value.map((m) => this.mapMessage(m));
  }

  async getMessage(id: string): Promise<EmailMessage> {
    const data = (await this.graphGet(`/me/messages/${id}`)) as Record<string, unknown>;
    return this.mapMessage(data);
  }

  async send(draft: EmailDraft): Promise<string> {
    const token = await this.getToken();
    const payload = this.buildSendMailBody(draft);

    const res = await this.fetchImpl(`${BASE_URL}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      const msg = body?.error?.message ?? res.statusText;
      throw new Error(`Graph API ${res.status}: ${msg}`);
    }

    return `sent-${Date.now()}`;
  }

  async search(query: string): Promise<EmailMessage[]> {
    const encoded = encodeURIComponent(`"${query}"`);
    const data = (await this.graphGet(`/me/messages?$search=${encoded}`)) as {
      value: Array<Record<string, unknown>>;
    };
    return data.value.map((m) => this.mapMessage(m));
  }
}
