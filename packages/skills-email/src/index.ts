export type { EmailClient, EmailFolder, EmailMessage, EmailAttachment, EmailDraft, ListOptions, EmailConfig, EmailToolClients, DeviceCodeInfo, AuthResult } from "./types.js";
export { GmailEmailClient } from "./gmail/client.js";
export { GraphEmailClient } from "./graph/graph-client.js";
export { registerEmailTools } from "./tools.js";