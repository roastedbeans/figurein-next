import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Direct Postgres connection for server-side ORM queries. RLS won't apply
// here because we connect as the service role — gate queries in route
// handlers with the user's Supabase session before calling into drizzle,
// or use the supabase-js client (which runs as the signed-in user) for
// anything RLS-policed.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, {
    // Drizzle's postgres-js driver needs prepared statements off when the
    // URL points at Supabase's transaction pooler (port 6543). Leaving this
    // on means the session pooler (5432) and direct connections still get
    // statement caching — which is what we want for app queries.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
