import "server-only";
import { sql } from "@/lib/db";

export interface Restore {
  token: string;
  owner: string;
  // null for the first restore links, which only reconnect the browser
  entries: { titleId: number; tier: string | null; state: string }[] | null;
  savedAt: Date | null;
}

const MAX_BACKUPS = 20;

export async function createBackup(userId: string): Promise<{ token: string; count: number }> {
  const [row] = await sql`
    INSERT INTO backups (token, user_id, list_name, entries)
    SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), u.id, u.list_name,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('titleId', r.title_id, 'tier', r.tier, 'state', r.state) ORDER BY r.updated_at)
        FROM ratings r WHERE r.user_id = u.id
      ), '[]')
    FROM users u WHERE u.id = ${userId}
    RETURNING token, jsonb_array_length(entries) AS count
  `;
  await sql`
    DELETE FROM backups WHERE user_id = ${userId} AND token NOT IN (
      SELECT token FROM backups WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${MAX_BACKUPS}
    )
  `;
  return { token: String(row.token), count: Number(row.count) };
}

export async function findRestore(token: string): Promise<Restore | null> {
  if (!/^[\w-]{32,64}$/.test(token)) return null;
  const [backup] = await sql`SELECT user_id, entries, created_at FROM backups WHERE token = ${token}`;
  if (backup) {
    return { token, owner: String(backup.user_id), entries: backup.entries as Restore["entries"], savedAt: backup.created_at as Date };
  }
  const [user] = await sql`SELECT id FROM users WHERE restore_token = ${token}`;
  return user ? { token, owner: String(user.id), entries: null, savedAt: null } : null;
}

// True when the owner's list changed since the backup, so restoring would drop those changes
export async function restoreOverwrites(restore: Restore): Promise<boolean> {
  if (!restore.entries) return false;
  const rows = await sql`SELECT title_id, tier, state FROM ratings WHERE user_id = ${restore.owner}`;
  const key = (id: unknown, tier: unknown, state: unknown) => `${id}:${tier ?? ""}:${state}`;
  const saved = new Set(restore.entries.map((e) => key(e.titleId, e.tier, e.state)));
  return rows.length > 0 && (rows.length !== saved.size || rows.some((r) => !saved.has(key(r.title_id, r.tier, r.state))));
}

export async function applyRestore(restore: Restore) {
  if (!restore.entries) return;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM ratings WHERE user_id = ${restore.owner}`;
    await tx`
      INSERT INTO ratings (user_id, title_id, tier, state)
      SELECT b.user_id, e."titleId", e.tier, e.state
      FROM backups b, jsonb_to_recordset(b.entries) AS e("titleId" INTEGER, tier CHAR(1), state TEXT)
      WHERE b.token = ${restore.token} AND EXISTS (SELECT 1 FROM titles t WHERE t.id = e."titleId")
    `;
    await tx`UPDATE users u SET list_name = b.list_name FROM backups b WHERE b.token = ${restore.token} AND u.id = b.user_id`;
  });
}
