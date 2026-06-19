export { getVersion as getAppVersion } from "./version.js";
export { DesktopStore } from "./main/store.js";
export { registerIpcHandlers, registerWindowHandlers } from "./main/ipc.js";
export type { AppSettings, UserProfile } from "./main/schemas.js";
export { resolveSecrets } from "./main/resolve-secrets.js";
export type { ResolveSecretsOptions, OpClient } from "./main/resolve-secrets.js";
