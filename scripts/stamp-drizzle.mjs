// Marks every drizzle migration in `drizzle/` as already applied without
// running its DDL. Needed once, right after `db:generate` creates a 0000
// migration that represents tables which were bootstrapped out-of-band (via
// `db:apply` of the Supabase SQL migrations). After this runs, `db:migrate`
// treats 0000 as done and only runs anything newer.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local or .env.");
  process.exit(1);
}

const journalPath = "drizzle/meta/_journal.json";
const journal = JSON.parse(await readFile(journalPath, "utf8"));
if (!journal.entries?.length) {
  console.log("No journal entries — nothing to stamp.");
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false });

try {
  await client.unsafe(`create schema if not exists drizzle`);
  await client.unsafe(
    `create table if not exists drizzle.__drizzle_migrations (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`
  );

  for (const entry of journal.entries) {
    const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const [existing] = await client`
      select id from drizzle.__drizzle_migrations where hash = ${hash}
    `;
    if (existing) {
      console.log(`  ${entry.tag}: already stamped (id ${existing.id})`);
      continue;
    }
    await client`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${entry.when})
    `;
    console.log(`  ${entry.tag}: stamped`);
  }
} finally {
  await client.end();
}
