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
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
  return id;
}
