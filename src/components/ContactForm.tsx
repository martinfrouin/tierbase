"use client";

import { track } from "@vercel/analytics";
import { useActionState, useEffect, useState } from "react";
import { sendContactMessage } from "@/app/contact-actions";
import { MAX_BODY, type ContactState } from "@/lib/contact";

const initial: ContactState = { status: "idle", message: "" };

export default function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initial);
  // The confirmation of this result was closed with "Send another message"
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  // The toast of this result has been shown long enough
  const [toastDone, setToastDone] = useState<ContactState | null>(null);

  useEffect(() => {
    if (state.status !== "sent") return;
    track("Contact message sent");
    const timer = setTimeout(() => setToastDone(state), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const toastEl = state.status === "sent" && toastDone !== state && (
    <div className="toast" role="status">
      ✓ Message sent
    </div>
  );

  if (state.status === "sent" && dismissed !== state) {
    return (
      <>
        <div className="notice contact-sent" role="status">
          <strong>✓ Message sent</strong>
          <p className="muted">Thanks! If you left your email, the answer will come there.</p>
          <button type="button" className="button" onClick={() => setDismissed(state)}>
            Send another message
          </button>
        </div>
        {toastEl}
      </>
    );
  }
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form key={`${state.attempt ?? 0}-${dismissed ? "again" : "first"}`} action={action} className="contact-form">
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
      <input
        type="text"
        name="hp_extra"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="honeypot"
        // Password managers and browser autofill ignore autocomplete="off" and would fill a "website" field
        data-1p-ignore
        data-lpignore="true"
        data-bwignore
        data-form-type="other"
      />
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
