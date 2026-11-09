"use client";

import { track } from "@vercel/analytics";
import { useActionState, useEffect } from "react";
import { sendContactMessage } from "@/app/contact-actions";
import { MAX_BODY, type ContactState } from "@/lib/contact";

const initial: ContactState = { status: "idle", message: "" };

export default function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initial);

  useEffect(() => {
    if (state.status === "sent") track("Contact message sent");
  }, [state]);

  if (state.status === "sent") return <p className="notice">{state.message}</p>;
  const values = state.values;

  return (
    <form key={state.attempt ?? 0} action={action} className="contact-form">
      <label>
        Subject
        <select name="subject" defaultValue={values?.subject ?? "missing-title"} required>
          <option value="missing-title">A title is missing</option>
          <option value="bug">Something is broken</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>
        Message
        <textarea name="body" rows={6} maxLength={MAX_BODY} defaultValue={values?.body} required />
      </label>
      <label>
        <span>
          Email <span className="muted">(optional, only if you want an answer)</span>
        </span>
        <input type="email" name="email" maxLength={200} autoComplete="email" defaultValue={values?.email} />
      </label>
      {/* Honeypot: hidden from people and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="honeypot" />
      {state.status === "error" && (
        <p className="form-error" aria-live="polite">
          {state.message}
        </p>
      )}
      <button type="submit" className="button primary" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
