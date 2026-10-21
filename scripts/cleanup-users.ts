import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

// Nothing to lose: no rating and no restore link, past the time a visitor might come back to it
const empty = await sql`
  DELETE FROM users u WHERE u.created_at < now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM backups b WHERE b.user_id = u.id)
`;
// The cookie lasts two years from the last visit: past that, no browser can reach the account
const unreachable = await sql`DELETE FROM users WHERE last_seen < now() - interval '2 years'`;

console.log(`Removed ${empty.count} empty and ${unreachable.count} unreachable accounts`);
await sql.end();
