import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import { getTopCovers } from "@/lib/data";
import { UNIVERSE_CONFIG, UNIVERSES, universePath, type Universe } from "@/lib/universes";

const PREVIEW = 6;

const PITCH: Record<Universe, { title: string; text: string; cta: string }> = {
  reading: {
    title: "Manga, manhwa & manhua",
    text: "What readers who share your taste loved, from thousands of Reddit recommendations.",
    cta: "Find your next read →",
  },
  games: {
    title: "Video games",
    text: "Roguelites, RPGs, metroidvanias and more, ranked by what players recommend on Reddit.",
    cta: "Find your next game →",
  },
};

async function Covers({ universe }: { universe: Universe }) {
  const top = await getTopCovers(universe, PREVIEW);
  return (
    <div className="universe-covers" aria-hidden>
      {top.map((t) => (
        <Cover key={t.id} src={t.cover} size="medium" />
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <section className="hero">
        <h1>Find your next favorite</h1>
        <p className="muted">
          Pick what you loved, get recommendations from people with the same taste, and build tier lists worth
          sharing.
        </p>
      </section>
      <div className="universe-cards">
        {UNIVERSES.map((u) => (
          <Link key={u} href={universePath(u)} className="universe-card">
            <h2>
              <span aria-hidden>{UNIVERSE_CONFIG[u].emoji}</span> {PITCH[u].title}
            </h2>
            <Suspense fallback={<div className="universe-covers" />}>
              <Covers universe={u} />
            </Suspense>
            <p className="muted">{PITCH[u].text}</p>
            <span className="button primary">{PITCH[u].cta}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
