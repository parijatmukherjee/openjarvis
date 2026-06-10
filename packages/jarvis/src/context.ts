import type { Intent } from "./intent.js";

export interface JarvisContext {
  sessionId: string;
  userId: string;
  recentIntents: Intent[];
  currentTime: Date;
  location?: string;
}
