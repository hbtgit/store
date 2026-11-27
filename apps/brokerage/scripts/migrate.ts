import { getDb } from "../src/db/client";

/** Applies app database migrations: `pnpm migrate`. */
getDb()
  .then(async (pool) => {
    console.log("Brokerage database is up to date");
    await pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
