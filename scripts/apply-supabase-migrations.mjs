// Apply every `supabase/migrations/*.sql` in sorted order (same as Supabase CLI).
// Requires DATABASE_URL in .env / .env.local.

import { config } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local or .env");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase/migrations");
const files = (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = postgres(url, { max: 1, prepare: false });

try {
  for (const f of files) {
    const sql = await readFile(join(dir, f), "utf8");
    process.stdout.write(`Applying ${f}… `);
    await client.unsafe(sql);
    console.log("ok");
  }
} catch (err) {
  console.error("\nFailed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await client.end();
}
