"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import HeaderSearch from "@/components/HeaderSearch";
import { UNIVERSE_CONFIG, UNIVERSES, universeOfPath, universePath, type Universe } from "@/lib/universes";

// Outside a universe (landing, contact…) no switch tab is active and the links lead to Reading
export function SiteNavLinks({ universe, children }: { universe: Universe | null; children?: ReactNode }) {
  const linked = universe ?? "reading";
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
        <Link href={universePath(linked, "/ranking")}>Ranking</Link>
        <Link href={universePath(linked, "/tierlist")} className="nav-cta">
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
  return <SiteNavLinks universe={universeOfPath(usePathname())}>{children}</SiteNavLinks>;
}
