import type { EventStore, DomainEvent } from "@openhawkins/core";
import { type SqlDriver, type SqlStatement, openDatabase } from "./driver/driver.js";
import { migrate } from "./migrate.js";
import { SCHEMA } from "./schema.js";

/**
 * VINES — a durable implementation of core's `EventStore` over embedded SQLite.
 * Because the S1 `Session` writes only through `append` and rebuilds state by
 * folding `read`, swapping `InMemoryEventStore -> SqliteEventStore` is the only
 * change a caller makes; replay and single-writer integrity are unchanged.
 */
export class SqliteEventStore implements EventStore {
  private readonly db: SqlDriver;
  private readonly insertStmt: SqlStatement;
  private readonly selectStmt: SqlStatement;

  constructor(db: SqlDriver) {
    this.db = db;
    migrate(db, SCHEMA);
    this.insertStmt = db.prepare(
      "INSERT INTO events (session_id, type, payload, at) VALUES (?, ?, ?, ?)",
    );
    this.selectStmt = db.prepare("SELECT payload FROM events WHERE session_id = ? ORDER BY seq");
  }

  /** Open (or create) a database file (or ":memory:") and run migrations. */
  static open(path: string): SqliteEventStore {
    return new SqliteEventStore(openDatabase({ path }));
  }

  async append(event: DomainEvent): Promise<void> {
    this.insertStmt.run(event.sessionId, event.type, JSON.stringify(event), event.at);
  }

  async read(sessionId: string): Promise<DomainEvent[]> {
    const rows = this.selectStmt.all(sessionId) as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as DomainEvent);
  }

  close(): void {
    this.db.close();
  }
}
