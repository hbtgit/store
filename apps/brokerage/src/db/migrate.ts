import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Queryable } from "./types";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "db", "migrations");

/** Applies pending .sql migrations in filename order. Safe to run on every start. */
export async function migrate(db: Queryable, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort();

  for (const name of pending) {
    await db.query(readFileSync(path.join(dir, name), "utf8"));
    await db.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
  }
  return pending;
}
