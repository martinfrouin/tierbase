"use server";

import { after } from "next/server";
import { Resend } from "resend";
import { MAX_BODY, SUBJECTS, type ContactState, type Subject } from "@/lib/contact";
import { sql } from "@/lib/db";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { ensureUserId } from "@/lib/user";

const MAX_PER_USER_PER_HOUR = 5;
// Bots that drop the cookie get a new account each time: a global cap keeps the table small anyway
const MAX_PER_DAY = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT: ContactState = { status: "sent", message: "Thanks, your message was sent." };
const SUBJECT_LABELS: Record<Subject, string> = { "missing-title": "Missing title", bug: "Bug", other: "Other" };

// Forwards the message to the contact inbox; the database copy stays the source of truth if this fails
async function notify(subject: Subject, body: string, email: string) {
  if (!process.env.RESEND_API_KEY) return;
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `${SITE_NAME} <noreply@tierbase.io>`,
    to: CONTACT_EMAIL,
    subject: `[${SITE_NAME}] ${SUBJECT_LABELS[subject]}`,
    text: `${body}\n\n— ${email || "No email left"}`,
    replyTo: email || undefined,
  });
  if (error) console.error("Contact email failed", error);
  else console.info("Contact email sent");
}

export async function sendContactMessage(prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: hidden from people, filled by bots. Pretend it worked.
  if (String(form.get("hp_extra") ?? "")) {
    console.info("Contact message dropped: honeypot filled");
    return SENT;
  }

  const subject = String(form.get("subject") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const error = (message: string): ContactState => {
    console.info(`Contact message refused: ${message}`);
    return {
      status: "error",
      message,
      values: { subject, body, email },
      attempt: (prev.attempt ?? 0) + 1,
    };
  };

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
    // After the response: the visitor doesn't wait for the email to go out
    after(() => notify(subject as Subject, body, email));
    console.info("Contact message saved");
    return SENT;
  } catch (e) {
    console.error("Contact message failed", e);
    return error("Couldn't send your message, try again in a moment.");
  }
}
