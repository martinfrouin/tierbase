import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

const COOKIE = "pr_uid";

export async function currentUserId(): Promise<string | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

// Only callable from Server Actions / Route Handlers, where cookies can be written
export async function ensureUserId(): Promise<string> {
  const existing = await currentUserId();
  if (existing) {
    const rows = await sql`SELECT 1 FROM users WHERE id = ${existing}`;
    if (rows.length) return existing;
  }

  const id = randomUUID();
  await sql`INSERT INTO users (id, share_id) VALUES (${id}, ${randomBytes(6).toString("base64url")})`;
  await setUserCookie(id);
  return id;
}

export async function setUserCookie(id: string) {
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
}

export async function getRestoreToken(userId: string): Promise<string | null> {
  const [row] = await sql`
    UPDATE users SET restore_token = COALESCE(restore_token, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
    WHERE id = ${userId} RETURNING restore_token
  `;
  return row ? String(row.restore_token) : null;
}

export async function userIdByRestoreToken(token: string): Promise<string | null> {
  if (!/^[\w-]{32,64}$/.test(token)) return null;
  const [row] = await sql`SELECT id FROM users WHERE restore_token = ${token}`;
  return row ? String(row.id) : null;
}
