# Step 1: Header search and contact form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search button to the site header that finds any title, and a `/contact` page whose messages are stored in Postgres.

**Architecture:** The header search is a client component calling the existing `search` Server Action (debounced, stale responses ignored). The contact form is a client component using React `useActionState` with a new `sendContactMessage` Server Action that validates input, applies anti-spam checks (honeypot, per-user and global rate limits) and inserts into a new `contact_messages` table. A `npm run messages` script prints recent messages.

**Tech Stack:** Next.js 16.4 App Router (Server Actions, Cache Components), React 19.3, `postgres` (porsager), plain CSS in `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-11-09-video-games-design.md` (sections "Header" and "Contact form").

**Project notes for the implementer:**
- Read `node_modules/next/dist/docs/01-app/02-guides/forms.md` before writing the form (this Next.js version differs from older ones; see `AGENTS.md`).
- There is no test framework. Verification = `npm run lint`, `npm run build`, and manual checks against a local database (`npm run db:up`, `npm run db:seed`, `npm run dev`).
- The schema is applied by `npm run db:seed` (it runs `db/schema.sql`, which must stay idempotent). In production the VM worker runs it on restart after a deploy touching `db/**`.
- Ask the user before each commit.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `db/schema.sql` | modify | `contact_messages` table |
| `src/lib/contact.ts` | create | Contact subjects, limits and state type |
| `src/app/contact-actions.ts` | create | `sendContactMessage` Server Action (validation, anti-spam, insert) |
| `src/components/ContactForm.tsx` | create | Client form with `useActionState` |
| `src/app/contact/page.tsx` | create | `/contact` page |
| `src/components/HeaderSearch.tsx` | create | Search button + results overlay |
| `src/app/layout.tsx` | modify | Mount `HeaderSearch`, footer link to `/contact` |
| `src/app/globals.css` | modify | Styles for search overlay and form |
| `src/app/privacy/page.tsx` | modify | Mention what the contact form stores |
| `scripts/messages.ts` | create | Print latest messages |
| `package.json` | modify | `messages` script |
| `README.md` | modify | Document `npm run messages` |

---

### Task 1: `contact_messages` table

**Files:**
- Modify: `db/schema.sql` (append at the end)

- [ ] **Step 1: Append the table**

```sql
-- Messages sent from /contact. user_id only serves rate limiting and outlives nothing: it goes with the account.
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL CHECK (subject IN ('missing-title', 'bug', 'other')),
  email TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at);
```

- [ ] **Step 2: Apply it locally**

Run: `npm run db:up && npm run db:seed`
Expected: seed finishes with its usual `N titles (...), N threads, N mentions` line, no SQL error.

- [ ] **Step 3: Check the table exists**

Run: `docker compose exec -T db psql -U tierbase -d tierbase -c '\d contact_messages'`
Expected: the table description with the 6 columns. (If the service or user name differs, check `docker-compose.yml`.)

- [ ] **Step 4: Commit (after asking the user)**

```bash
git add db/schema.sql
git commit -m "Add contact_messages table"
```

---

### Task 2: `sendContactMessage` Server Action

**Files:**
- Create: `src/lib/contact.ts`
- Create: `src/app/contact-actions.ts`

Separate from `src/app/actions.ts` because it has its own state type and nothing in common with tier list actions. A `"use server"` file may only export async functions, so constants and types live in `src/lib/contact.ts`.

- [ ] **Step 1: Shared constants and types**

`src/lib/contact.ts`:

```ts
export const SUBJECTS = ["missing-title", "bug", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const MAX_BODY = 4000;

export interface ContactState {
  status: "idle" | "sent" | "error";
  message: string;
}
```

- [ ] **Step 2: Write the action**

`src/app/contact-actions.ts`:

```ts
"use server";

import { MAX_BODY, SUBJECTS, type ContactState, type Subject } from "@/lib/contact";
import { sql } from "@/lib/db";
import { ensureUserId } from "@/lib/user";

const MAX_PER_USER_PER_HOUR = 5;
// Bots that drop the cookie get a new account each time: a global cap keeps the table small anyway
const MAX_PER_DAY = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: hidden from people, filled by bots. Pretend it worked.
  if (String(form.get("website") ?? "")) return { status: "sent", message: "Thanks, your message was sent." };

  const subject = String(form.get("subject") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!SUBJECTS.includes(subject as Subject)) return { status: "error", message: "Pick a subject." };
  if (body.length < 5) return { status: "error", message: "Write a few words." };
  if (body.length > MAX_BODY) return { status: "error", message: `Keep it under ${MAX_BODY} characters.` };
  if (email && (email.length > 200 || !EMAIL.test(email))) return { status: "error", message: "This email doesn't look right." };

  try {
    const userId = await ensureUserId();
    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE user_id = ${userId} AND created_at > now() - interval '1 hour')::int AS mine,
        COUNT(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS everyone
      FROM contact_messages WHERE created_at > now() - interval '1 day'
    `;
    if (counts.mine >= MAX_PER_USER_PER_HOUR || counts.everyone >= MAX_PER_DAY) {
      return { status: "error", message: "Too many messages for now, try again later." };
    }
    await sql`
      INSERT INTO contact_messages (user_id, subject, email, body)
      VALUES (${userId}, ${subject}, ${email || null}, ${body})
    `;
    return { status: "sent", message: "Thanks, your message was sent." };
  } catch {
    return { status: "error", message: "Couldn't send your message, try again in a moment." };
  }
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no error for `src/lib/contact.ts` or `src/app/contact-actions.ts`.

---

### Task 3: Contact form and page

**Files:**
- Create: `src/components/ContactForm.tsx`
- Create: `src/app/contact/page.tsx`
- Modify: `src/app/globals.css` (append)

- [ ] **Step 1: Client form**

`src/components/ContactForm.tsx`:

```tsx
"use client";

import { track } from "@vercel/analytics";
import { useActionState, useEffect } from "react";
import { sendContactMessage } from "@/app/contact-actions";
import type { ContactState } from "@/lib/contact";

const initial: ContactState = { status: "idle", message: "" };

export default function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initial);

  useEffect(() => {
    if (state.status === "sent") track("Contact message sent");
  }, [state]);

  if (state.status === "sent") return <p className="notice">{state.message}</p>;

  return (
    <form action={action} className="contact-form">
      <label>
        Subject
        <select name="subject" defaultValue="missing-title" required>
          <option value="missing-title">A title is missing</option>
          <option value="bug">Something is broken</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>
        Message
        <textarea name="body" rows={6} maxLength={4000} required />
      </label>
      <label>
        Email <span className="muted">(optional, only if you want an answer)</span>
        <input type="email" name="email" maxLength={200} autoComplete="email" />
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
```

Note: when the action returns an error, React resets uncontrolled fields after a form action. If the typed message disappears on error during the manual check (Step 5), keep values by returning them in `ContactState` (`values: { subject, body, email }`) and passing them as `defaultValue` with a `key` that changes per submission.

- [ ] **Step 2: Page**

`src/app/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Suggest a missing title, report a bug or send any other message.",
};

export default function ContactPage() {
  return (
    <article className="legal">
      <h1>Contact</h1>
      <p className="muted">
        A title is missing, a match is wrong, something is broken? Tell me here. Your email is only used to answer you
        (see <Link href="/privacy">privacy</Link>).
      </p>
      <ContactForm />
    </article>
  );
}
```

- [ ] **Step 3: Styles**

Append to `src/app/globals.css`:

```css
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;
  margin-top: 24px;
}

.contact-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
}

.contact-form input,
.contact-form select,
.contact-form textarea {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 400;
}

.contact-form textarea {
  resize: vertical;
}

.contact-form button {
  align-self: flex-start;
}

.form-error {
  color: var(--tier-s);
  margin: 0;
}

.honeypot {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
```

- [ ] **Step 4: Build**

Run: `npm run lint && npm run build`
Expected: both succeed; `/contact` is listed in the build output.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open `http://localhost:3000/contact`:
1. Submit with an empty message → browser blocks it (`required`).
2. Type `abc` → "Write a few words."
3. Type a valid message with email `foo` → browser blocks it (`type="email"`).
4. Valid message + valid email → "Thanks, your message was sent."
5. Reload and send 5 more → the 6th within an hour shows "Too many messages for now…".

Then check: `docker compose exec -T db psql -U tierbase -d tierbase -c 'SELECT id, subject, email, left(body, 40) FROM contact_messages'` lists the messages.

- [ ] **Step 6: Commit (after asking the user)**

```bash
git add src/lib/contact.ts src/app/contact-actions.ts src/components/ContactForm.tsx src/app/contact/page.tsx src/app/globals.css
git commit -m "Add contact form"
```

---

### Task 4: Footer link and privacy page

**Files:**
- Modify: `src/app/layout.tsx` (footer `footer-links` paragraph)
- Modify: `src/app/privacy/page.tsx` ("What is stored" list and the line after it)

- [ ] **Step 1: Footer link**

In `src/app/layout.tsx`, replace:

```tsx
            <Link href="/legal">Legal notice</Link> · <Link href="/privacy">Privacy</Link> · Data from{" "}
```

with:

```tsx
            <Link href="/contact">Contact</Link> · <Link href="/legal">Legal notice</Link> ·{" "}
            <Link href="/privacy">Privacy</Link> · Data from{" "}
```

- [ ] **Step 2: Privacy page**

In `src/app/privacy/page.tsx`, add this item before the "Technical logs" item:

```tsx
        <li>
          <strong>Contact messages</strong> sent from the <Link href="/contact">contact page</Link>, with the email
          you leave if you want an answer. They are only read to answer you and deleted once handled.
        </li>
```

and replace:

```tsx
      <p>No email, name or payment data is ever collected.</p>
```

with:

```tsx
      <p>No name or payment data is ever collected, and no email unless you leave one in a contact message.</p>
```

Update the `Last updated` date at the top of the privacy page to `9 November 2026`.

- [ ] **Step 3: Build**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 4: Commit (after asking the user)**

```bash
git add src/app/layout.tsx src/app/privacy/page.tsx
git commit -m "Link the contact page and document what it stores"
```

---

### Task 5: `npm run messages`

**Files:**
- Create: `scripts/messages.ts`
- Modify: `package.json` (scripts)
- Modify: `README.md` (Stats section)

- [ ] **Step 1: Script**

`scripts/messages.ts`:

```ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 20);

const rows = await sql`
  SELECT id, created_at, subject, email, body FROM contact_messages ORDER BY created_at DESC LIMIT ${limit}
`;
if (rows.length === 0) console.log("No messages");
for (const r of rows.reverse()) {
  console.log(`#${r.id} · ${r.created_at.toISOString().slice(0, 16).replace("T", " ")} · ${r.subject}${r.email ? ` · ${r.email}` : ""}`);
  console.log(`${r.body}\n`);
}
await sql.end();
```

- [ ] **Step 2: npm script**

In `package.json` `scripts`, after `"stats"`:

```json
    "messages": "node --env-file-if-exists=.env --experimental-strip-types --no-warnings scripts/messages.ts"
```

(add the comma after the `stats` line).

- [ ] **Step 3: Run it**

Run: `npm run --silent messages`
Expected: the messages sent in Task 3, oldest first, each as a header line then the body.

- [ ] **Step 4: README**

In `README.md`, at the end of the "Stats" section (before "Visits come from…"), add:

````markdown
`npm run messages` prints the latest contact form messages (`--limit=N`, default 20). For production:

```bash
ssh <vm> 'cd ~/tierbase && docker compose -f compose.prod.yml exec -T worker npm run --silent messages'
```
````

- [ ] **Step 5: Commit (after asking the user)**

```bash
git add scripts/messages.ts package.json README.md
git commit -m "Add a script to read contact messages"
```

---

### Task 6: Header search

**Files:**
- Create: `src/components/HeaderSearch.tsx`
- Modify: `src/app/layout.tsx` (nav)
- Modify: `src/app/globals.css` (append)

Behavior: a magnifier button in the nav opens an overlay with an input (autofocused). Typing ≥ 2 characters calls `search` after 200 ms; stale responses are ignored. Results show cover + name + kind, link to `/title/[slug]`. Arrow keys move the highlight, Enter opens it, Escape or a click on the backdrop closes the overlay. `/` (outside inputs) and Cmd/Ctrl+K open it. On phones the overlay takes the full screen. Universe badges come with step 3 (games UI).

- [ ] **Step 1: Component**

`src/components/HeaderSearch.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { search } from "@/app/actions";
import Cover from "@/components/Cover";
import type { TitleCard } from "@/lib/data";
import { KINDS } from "@/lib/kinds";

const DEBOUNCE_MS = 200;

export default function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TitleCard[]>([]);
  const [active, setActive] = useState(0);
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    latest.current = value;
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const found = await search(value);
      if (latest.current !== value) return;
      setResults(found.slice(0, 8));
      setActive(0);
    }, DEBOUNCE_MS);
  };

  const go = (title: TitleCard) => {
    close();
    router.push(`/title/${title.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const kindLabel = (kind: string) => KINDS.find((k) => k.value === kind)?.label ?? kind;

  return (
    <>
      <button type="button" className="nav-icon search-button" aria-label="Search titles" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className="search-overlay" onClick={close}>
          <div className="search-panel" role="dialog" aria-label="Search titles" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="search"
              placeholder="Search a title…"
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="header-search-results"
              aria-activedescendant={results[active] ? `header-search-${results[active].id}` : undefined}
            />
            {results.length > 0 && (
              <ul id="header-search-results" className="search-results" role="listbox">
                {results.map((t, i) => (
                  <li
                    key={t.id}
                    id={`header-search-${t.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? "active" : undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(t)}
                  >
                    <Cover src={t.cover} size="small" />
                    <span>{t.name}</span>
                    <small className="muted">{kindLabel(t.kind)}</small>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="muted search-empty">
                No match yet. Missing title? <a href="/contact">Tell me</a>.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

Note: "No match yet" may flash while a request is in flight. If it's noticeable in the manual check, add a `searching` state set before the request and cleared after, and hide the message while it's true.

- [ ] **Step 2: Mount it in the header**

In `src/app/layout.tsx`, add the import:

```tsx
import HeaderSearch from "@/components/HeaderSearch";
```

and place `<HeaderSearch />` as the first child of `<nav>`, before `<Link href="/for-you">`.

- [ ] **Step 3: Styles**

Check how `.nav-icon` is styled in `globals.css` (`grep -n "nav-icon" src/app/globals.css`) so the button matches the GitHub icon. Then append:

```css
.search-button {
  display: inline-flex;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.search-button:hover {
  color: var(--text);
}

.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.6);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 80px 16px 16px;
}

.search-panel {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
}

.search-panel .search {
  width: 100%;
}

.search-results {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 60vh;
  overflow-y: auto;
}

.search-results li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.search-results li span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-results li.active {
  background: var(--surface-hover);
}

.search-empty {
  margin: 12px 8px 4px;
}

@media (max-width: 560px) {
  .search-overlay {
    padding: 0;
  }

  .search-panel {
    max-width: none;
    min-height: 100%;
    border-radius: 0;
    border: 0;
  }
}
```

- [ ] **Step 4: Build**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 5: Manual check (desktop and 375 px wide)**

With `npm run dev`:
1. Click the magnifier → overlay opens, input focused.
2. Type `solo` → "Solo Leveling" among the results with its cover and kind.
3. Arrow down/up moves the highlight; Enter opens the title page and closes the overlay.
4. Escape and a click outside the panel close it.
5. Press `/` on a page (not in an input) and Cmd+K → it opens. Typing `/` inside the tier list search does not open it.
6. Type `zzqx` → "No match yet. Missing title? Tell me." and the link goes to `/contact`.
7. At 375 px width the overlay is full screen and the header does not overflow horizontally (the nav now has one more item: if it wraps, reduce `gap` in `.site-header nav` under the 560 px media query).

- [ ] **Step 6: Commit (after asking the user)**

```bash
git add src/components/HeaderSearch.tsx src/app/layout.tsx src/app/globals.css
git commit -m "Add a search button to the header"
```

---

### Task 7: Final verification

- [ ] **Step 1:** `npm run lint && npm run build` → success.
- [ ] **Step 2:** Walk through the existing pages once (home, ranking, a title page, tier list, for you) to confirm nothing changed apart from the header and footer.
- [ ] **Step 3:** Deployment note for the user: pushing `db/schema.sql` triggers the VM deploy, whose worker re-runs `db:seed` on restart and creates `contact_messages`. Until it finishes (a few minutes), the form shows "Couldn't send your message…"; nothing else is affected.
