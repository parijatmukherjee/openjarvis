import type { Migration } from "./migrate.js";

/** Versioned schema for the durable stores. New tables are added as new migrations. */
export const SCHEMA: Migration[] = [
  {
    version: 1,
    name: "events",
    up: `
      CREATE TABLE events (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type       TEXT NOT NULL,
        payload    TEXT NOT NULL,
        at         INTEGER NOT NULL
      );
      CREATE INDEX events_by_session ON events (session_id, seq);
    `,
  },
];
