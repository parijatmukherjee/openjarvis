import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/driver/driver.js";

describe("SqlDriver (over the host's built-in SQLite)", () => {
  it("execs DDL, prepares statements, and runs/gets/alls", () => {
    const db = openDatabase({ path: ":memory:" });
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");

    const insert = db.prepare("INSERT INTO t (name) VALUES (?)");
    const res = insert.run("alice");
    expect(res.changes).toBe(1);
    expect(Number(res.lastInsertRowid)).toBe(1);

    expect(db.prepare("SELECT name FROM t WHERE id = ?").get(1)).toEqual({ name: "alice" });
    insert.run("bob");
    expect(db.prepare("SELECT name FROM t ORDER BY id").all()).toEqual([
      { name: "alice" },
      { name: "bob" },
    ]);
    db.close();
  });

  it("commits a successful transaction", () => {
    const db = openDatabase({ path: ":memory:" });
    db.exec("CREATE TABLE t (n INTEGER)");
    const out = db.transaction(() => {
      db.prepare("INSERT INTO t VALUES (?)").run(1);
      db.prepare("INSERT INTO t VALUES (?)").run(2);
      return "done";
    });
    expect(out).toBe("done");
    expect(db.prepare("SELECT COUNT(*) AS c FROM t").get()).toEqual({ c: 2 });
    db.close();
  });

  it("rolls back a failing transaction and rethrows", () => {
    const db = openDatabase({ path: ":memory:" });
    db.exec("CREATE TABLE t (n INTEGER)");
    expect(() =>
      db.transaction(() => {
        db.prepare("INSERT INTO t VALUES (?)").run(1);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(db.prepare("SELECT COUNT(*) AS c FROM t").get()).toEqual({ c: 0 });
    db.close();
  });

  it("surfaces a loadExtension failure for a missing extension path", () => {
    const db = openDatabase({ path: ":memory:", allowExtension: true });
    expect(() => db.loadExtension("/no/such/extension.so")).toThrow();
    db.close();
  });
});
