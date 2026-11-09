import postgres from "postgres";

// Reuse one pool across dev hot reloads
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    idle_timeout: 20,
    // A page gives up long before this, but Postgres would keep running an abandoned query: cut it off instead
    connection: { statement_timeout: 20_000 },
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
