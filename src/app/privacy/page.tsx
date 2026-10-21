import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="muted">Last updated: 20 October 2026</p>

      <p>{SITE_NAME} has no accounts and no ads. Here is everything it stores, and why.</p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>An anonymous identifier</strong> in a cookie, so the site recognizes your tier list when you come
          back. It is strictly necessary for the service, contains nothing about you, and expires after two years.
        </li>
        <li>
          <strong>Your ratings</strong>: the titles you rank, want to read or skip. They also feed the global ranking
          and other readers&apos; recommendations, without anything that identifies you.
        </li>
        <li>
          <strong>Your tier list name</strong>, if you set one. It is public to anyone you share your link with.
        </li>
        <li>
          <strong>Restore links</strong> you create: a copy of your list at that moment, kept until you make 20 newer
          ones.
        </li>
        <li>
          <strong>Technical logs</strong> (IP address, requests) kept by the hosts for security and debugging.
        </li>
      </ul>
      <p>No email, name or payment data is ever collected.</p>

      <h2>Audience measurement</h2>
      <p>
        Visits are counted with Vercel Web Analytics, which sets no cookie and keeps no personal data: only aggregated
        page views, referrers, countries and a few anonymous events (such as copying a share link). Visitors are told
        apart by a hash that resets every day, so nobody can be followed over time or across sites.
      </p>

      <h2>Reddit quotes</h2>
      <p>
        Title pages quote short excerpts of public Reddit comments with their author&apos;s username and a link to the
        thread, to show why readers recommend a title. If you wrote one of them and want it removed, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Where it lives</h2>
      <p>
        The database is hosted by Hetzner in Germany. The website is served by Vercel, in the United States, under the
        European Commission&apos;s standard contractual clauses. Nothing is sold or shared with anyone else.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see or delete your data at any time: send your tier list share link to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Clearing your cookies also disconnects you from your
        list, unless you saved its private restore link. You can also file a complaint with the CNIL (cnil.fr).
      </p>

      <p>
        <Link href="/legal">Legal notice</Link>
      </p>
    </article>
  );
}
