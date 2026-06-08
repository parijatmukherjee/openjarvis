import { createRequire } from "node:module";
import type { NativeDatabase, OpenOptions } from "./driver.js";

const requireCjs = createRequire(import.meta.url);

interface NodeSqliteModule {
  DatabaseSync: new (path: string, opts?: { allowExtension?: boolean }) => NativeDatabase;
}
interface BunSqliteModule {
  Database: new (path: string, opts?: { create?: boolean }) => NativeDatabase;
}

/**
 * Construct the host's built-in SQLite database. Bun ships `bun:sqlite`; Node ships
 * `node:sqlite` (unflagged from 22.13/23.4). The module name is held in a variable
 * so the bundler can't statically resolve the runtime we're NOT on (which would
 * fail at `bun build --compile` time). This file is the only runtime-specific glue
 * and is excluded from coverage — the cross-runtime wrapper lives in driver.ts.
 */
export function nativeOpen(opts: OpenOptions): NativeDatabase {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  const moduleName = isBun ? "bun:sqlite" : "node:sqlite";
  const mod: unknown = requireCjs(moduleName);
  if (isBun) {
    const { Database } = mod as BunSqliteModule;
    return new Database(opts.path, { create: true });
  }
  const { DatabaseSync } = mod as NodeSqliteModule;
  return new DatabaseSync(opts.path, { allowExtension: opts.allowExtension ?? false });
}
