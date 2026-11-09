"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import HeaderSearch from "@/components/HeaderSearch";
import { UNIVERSE_CONFIG, UNIVERSES, universeOfPath, universePath, type Universe } from "@/lib/universes";

// Outside a universe (landing, contact…) no switch tab is active and the links lead to Reading
export function SiteNavLinks({
  universe,
  pathname = "",
  children,
}: {
  universe: Universe | null;
  pathname?: string;
  children?: ReactNode;
}) {
  const linked = universe ?? "reading";
  // The link of the current page stands out; shared tier lists of other people don't count as "My tier list"
  const current = (href: string) => (pathname === href ? "page" : undefined);
  return (
    <>
      <div className="universe-switch" role="navigation" aria-label="Universe">
        {UNIVERSES.map((u) => (
          <Link key={u} href={universePath(u)} className={u === universe ? "active" : undefined} aria-current={u === universe}>
            <span aria-hidden>{UNIVERSE_CONFIG[u].emoji}</span> {UNIVERSE_CONFIG[u].label}
          </Link>
        ))}
      </div>
      <nav>
        <HeaderSearch />
        <Link href={universePath(linked)} aria-current={current(universePath(linked))}>
          For you
        </Link>
        <Link href={universePath(linked, "/ranking")} aria-current={current(universePath(linked, "/ranking"))}>
          Ranking
        </Link>
        <Link
          href={universePath(linked, "/tierlist")}
          className="nav-cta"
          aria-current={current(universePath(linked, "/tierlist"))}
        >
          My tier list
        </Link>
        {children}
      </nav>
    </>
  );
}

// Header links follow the universe of the current page: Ranking and My tier list of Reading or of Games.
// Reading the pathname suspends on pages with an unknown slug: the layout wraps this in <Suspense>.
export default function SiteNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <SiteNavLinks universe={universeOfPath(pathname)} pathname={pathname}>
      {children}
    </SiteNavLinks>
  );
}
