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

  private async requestWithRetry(
    url: string,
    init: RequestInit & { method?: string },
    maxRetries = 3,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await this.fetchImpl(url, init);

      if (res.status === 429) {
        if (attempt >= maxRetries) {
          throw new Error(`Graph API ${init.method ?? "GET"} ${url}: too many 429 responses`);
        }
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500 && res.status < 600) {
        if (attempt >= maxRetries) {
          throw new Error(
            `Graph API ${init.method ?? "GET"} ${url}: ${res.status} server error after ${maxRetries} retries`,
          );
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      return res;
    }
    throw new Error("unreachable");
  }

  private async graphGet(path: string): Promise<unknown> {
    const token = await this.getToken();
    const url = `${BASE_URL}${path}`;
    const res = await this.requestWithRetry(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let message: string;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body?.error?.message ?? res.statusText;
      } catch {
        message = res.statusText;
      }
      throw new Error(`Graph API GET ${path} failed: ${res.status} ${message}`);
    }
    return res.json();
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

    const res = await this.requestWithRetry(`${BASE_URL}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message: string;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body?.error?.message ?? res.statusText;
      } catch {
        message = res.statusText;
      }
      throw new Error(`Graph API POST /me/sendMail failed: ${res.status} ${message}`);
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
