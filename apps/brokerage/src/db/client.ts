import { Pool } from "pg";

import { migrate } from "./migrate";

let pool: Pool | undefined;
let ready: Promise<unknown> | undefined;

/** Shared pool for the app database (BROKERAGE_DATABASE_URL). Migrates on first use. */
export async function getDb(): Promise<Pool> {
  if (!pool) {
    const connectionString = process.env.BROKERAGE_DATABASE_URL;
    if (!connectionString) throw new Error("BROKERAGE_DATABASE_URL is not set");
    pool = new Pool({ connectionString });
    ready = migrate(pool);
  }
  await ready;
  return pool;
}
