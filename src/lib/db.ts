import postgres from "postgres";

// Reuse one pool across dev hot reloads
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql = globalForDb.sql ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
