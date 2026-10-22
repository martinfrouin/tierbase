import "server-only";
import { sql } from "@/lib/db";

export interface Restore {
  token: string;
  entries: { titleId: number; tier: string | null; state: string }[];
  savedAt: Date | null;
}

const MAX_BACKUPS = 20;

export async function createBackup(userId: string): Promise<{ token: string; count: number }> {
  const [row] = await sql`
    INSERT INTO backups (token, user_id, entries)
    SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), u.id,
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
  const [backup] = await sql`SELECT entries, created_at FROM backups WHERE token = ${token}`;
  if (backup) {
    return {
      token,
      entries: backup.entries as Restore["entries"],
      savedAt: backup.created_at as Date,
    };
  }
  // The first restore links pointed at an account: they copy its list as it is today
  const [user] = await sql`SELECT id FROM users WHERE restore_token = ${token}`;
  if (!user) return null;
  const rows = await sql`SELECT title_id, tier, state FROM ratings WHERE user_id = ${user.id} ORDER BY updated_at`;
  return {
    token,
    entries: rows.map((r) => ({ titleId: Number(r.title_id), tier: (r.tier as string | null) ?? null, state: String(r.state) })),
    savedAt: null,
  };
}

// True when the reader's list holds something the restore would drop
export async function restoreOverwrites(restore: Restore, userId: string): Promise<boolean> {
  const rows = await sql`SELECT title_id, tier, state FROM ratings WHERE user_id = ${userId}`;
  const key = (id: unknown, tier: unknown, state: unknown) => `${id}:${tier ?? ""}:${state}`;
  const saved = new Set(restore.entries.map((e) => key(e.titleId, e.tier, e.state)));
  return rows.length > 0 && (rows.length !== saved.size || rows.some((r) => !saved.has(key(r.title_id, r.tier, r.state))));
}

export async function applyRestore(restore: Restore, userId: string) {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM ratings WHERE user_id = ${userId}`;
    await tx`
      INSERT INTO ratings (user_id, title_id, tier, state)
      SELECT ${userId}, e."titleId", e.tier, e.state
      FROM jsonb_to_recordset(${tx.json(restore.entries)}::jsonb) AS e("titleId" INTEGER, tier CHAR(1), state TEXT)
      WHERE EXISTS (SELECT 1 FROM titles t WHERE t.id = e."titleId")
      ON CONFLICT DO NOTHING
    `;
  });
}
