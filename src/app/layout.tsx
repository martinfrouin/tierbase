import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { cacheLife } from "next/cache";
import { sql } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — find your next manhwa, manga or manhua`, template: `%s · ${SITE_NAME}` },
  description: "Personal manga, manhwa and manhua recommendations built from what Reddit readers actually recommend.",
};

async function Stats() {
  "use cache";
  cacheLife("hours");
  const [stats] = await sql`
    SELECT (SELECT COUNT(DISTINCT comment_id)::int FROM mentions) AS comments, (SELECT COUNT(*)::int FROM threads) AS threads
  `;
  return (
    <>
      Seeded from {Number(stats.comments).toLocaleString("en")} Reddit comments across{" "}
      {Number(stats.threads).toLocaleString("en")} recommendation threads, then refined by your votes.
    </>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            {SITE_NAME}
          </Link>
          <nav>
            <Link href="/for-you">For you</Link>
            <Link href="/ranking">Ranking</Link>
            <Link href="/tierlist">My tier list</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <Stats />
        </footer>
      </body>
    </html>
  );
}
