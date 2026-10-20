import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Legal notice" };

export default function LegalPage() {
  return (
    <article className="legal">
      <h1>Legal notice</h1>
      <p className="muted">Last updated: 20 October 2026</p>

      <h2>Publisher</h2>
      <p>
        {SITE_NAME} is a free, non-commercial personal project published by Martin Frouin. Contact:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>Hosting</h2>
      <p>
        <strong>Website</strong>: Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, United States (vercel.com)
        <br />
        <strong>Database</strong>: Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany (hetzner.com)
      </p>

      <h2>Data sources</h2>
      <p>
        Titles, covers and genres come from <a href="https://anilist.co">AniList</a>. Covers and titles belong to their
        respective authors and publishers and are shown only to identify each work, with a link to its source.
      </p>
      <p>
        Reddit mentions come from public comments in recommendation threads, collected through the{" "}
        <a href="https://arctic-shift.photon-reddit.com">Arctic Shift</a> archive. Each quote is a short excerpt linked
        to the original thread. {SITE_NAME} is not affiliated with Reddit or AniList.
      </p>

      <h2>Removal requests</h2>
      <p>
        If you hold rights to an image, wrote a quoted comment, or see an offensive tier list name, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and it will be removed promptly.
      </p>

      <h2>Personal data</h2>
      <p>
        See the <Link href="/privacy">privacy policy</Link>.
      </p>
    </article>
  );
}
