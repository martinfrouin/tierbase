"use server";

import { MAX_BODY, SUBJECTS, type ContactState, type Subject } from "@/lib/contact";
import { sql } from "@/lib/db";
import { ensureUserId } from "@/lib/user";

const MAX_PER_USER_PER_HOUR = 5;
// Bots that drop the cookie get a new account each time: a global cap keeps the table small anyway
const MAX_PER_DAY = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT: ContactState = { status: "sent", message: "Thanks, your message was sent." };

export async function sendContactMessage(prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: hidden from people, filled by bots. Pretend it worked.
  if (String(form.get("website") ?? "")) return SENT;

  const subject = String(form.get("subject") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const error = (message: string): ContactState => ({
    status: "error",
    message,
    values: { subject, body, email },
    attempt: (prev.attempt ?? 0) + 1,
  });

  if (!SUBJECTS.includes(subject as Subject)) return error("Pick a subject.");
  if (body.length < 5) return error("Write a few words.");
  if (body.length > MAX_BODY) return error(`Keep it under ${MAX_BODY} characters.`);
  if (email && (email.length > 200 || !EMAIL.test(email))) return error("This email doesn't look right.");

  try {
    const userId = await ensureUserId();
    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE user_id = ${userId} AND created_at > now() - interval '1 hour')::int AS mine,
        COUNT(*)::int AS everyone
      FROM contact_messages WHERE created_at > now() - interval '1 day'
    `;
    if (counts.mine >= MAX_PER_USER_PER_HOUR || counts.everyone >= MAX_PER_DAY) {
      return error("Too many messages for now, try again later.");
    }
    await sql`
      INSERT INTO contact_messages (user_id, subject, email, body)
      VALUES (${userId}, ${subject}, ${email || null}, ${body})
    `;
    return SENT;
  } catch {
    return error("Couldn't send your message, try again in a moment.");
  }
}
