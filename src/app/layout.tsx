import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist } from "next/font/google";
import { cacheLife } from "next/cache";
import { sql } from "@/lib/db";
import { REPO_URL, SITE_NAME, SPONSOR_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — find your next manhwa, manga or manhua`,
    template: `%s · ${SITE_NAME}`,
  },
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
          <Link href="/" className="brand" aria-label={SITE_NAME}>
            <Image src="/emblem.png" alt="" width={40} height={40} priority />
            <span>
              Tier<span className="brand-gradient">Base</span>
            </span>
          </Link>
          <nav>
            <Link href="/for-you">For you</Link>
            <Link href="/ranking">Ranking</Link>
            <Link href="/tierlist" className="nav-cta">
              My tier list
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="nav-icon" aria-label="Source code on GitHub">
              <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <Stats />
          <p>
            Free and open source. If it found you a good read,{" "}
            <a href={SPONSOR_URL} target="_blank" rel="noreferrer">
              buy me a coffee ☕
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
