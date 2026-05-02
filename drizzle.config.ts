import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit only auto-loads `.env`, not `.env.local` — pull it in explicitly.
config({ path: ".env.local" });

// Drizzle talks to Supabase over a direct Postgres connection, not the REST
// API the @supabase/supabase-js client uses. Grab the URL from Supabase ->
// Project Settings -> Database -> Connection string (URI format). The
// session pooler URL (port 5432 with ?pgbouncer=true) is the right choice
// for migrations and local work; the transaction pooler (6543) doesn't
// support the prepared statements drizzle-kit emits.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Stay out of Supabase-managed schemas (auth, storage, realtime, etc.).
  // Drizzle only needs `public` — touching `auth` would try to recreate
  // tables Supabase owns.
  schemaFilter: ["public"],
});
