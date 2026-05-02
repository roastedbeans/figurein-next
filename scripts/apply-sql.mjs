// One-off SQL runner for the supabase/migrations/*.sql files.
// Uses postgres.js with prepared statements disabled so it works against
// Supabase's transaction pooler (port 6543) as well as the session pooler.
// All migrations are idempotent (create table if not exists, drop policy
// if exists, etc.), so re-running is safe.

import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local or .env");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: bun run scripts/apply-sql.mjs <file1.sql> [file2.sql ...]");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });

try {
  for (const file of files) {
    const sql = await readFile(file, "utf8");
    process.stdout.write(`Applying ${file}… `);
    await client.unsafe(sql);
    console.log("ok");
  }
} catch (err) {
  console.error("\nFailed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await client.end();
}
