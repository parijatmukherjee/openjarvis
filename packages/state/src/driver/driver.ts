import { nativeOpen } from "./select.js";

/** The subset of the native SQLite handle the wrapper relies on (node + bun both satisfy it). */
export interface NativeStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
export interface NativeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NativeStatement;
  loadExtension(path: string): void;
  close(): void;
}

export interface SqlRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}
export interface SqlStatement {
  run(...params: unknown[]): SqlRunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
export interface SqlDriver {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  loadExtension(path: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

export interface OpenOptions {
  path: string;
  allowExtension?: boolean;
}

/**
 * Open an embedded SQLite database behind the runtime-agnostic `SqlDriver` port. The
 * wrapper is identical on Node and Bun because `node:sqlite` and `bun:sqlite` expose
 * the same method shape; only construction differs (handled in `select.ts`).
 */
export function openDatabase(opts: OpenOptions): SqlDriver {
  const native = nativeOpen(opts);
  return {
    exec: (sql) => native.exec(sql),
    prepare: (sql) => {
      const stmt = native.prepare(sql);
      return {
        run: (...params) => {
          const r = stmt.run(...params);
          return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
        },
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
      };
    },
    loadExtension: (path) => native.loadExtension(path),
    transaction: <T>(fn: () => T): T => {
      native.exec("BEGIN");
      try {
        const result = fn();
        native.exec("COMMIT");
        return result;
      } catch (err) {
        native.exec("ROLLBACK");
        throw err;
      }
    },
    close: () => native.close(),
  };
}
