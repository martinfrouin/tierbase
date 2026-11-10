import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import FilterChips from "@/components/FilterChips";
import { getRankingPage, scoreOutOf100 } from "@/lib/data";
import { describeFilters, filterParams, parseFilters, type TitleFilters } from "@/lib/title-filters";
import { titleHref, UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";
import { RankingSkeleton } from "@/components/Skeletons";

export type RankingParams = { kind?: string; genre?: string; q?: string; page?: string };

const PAGE_SIZE = 50;

// "Best manhwa" and "Best roguelites" are the searches people make: each filter gets its own title and canonical URL
function heading(universe: Universe, filters: TitleFilters) {
  return `Best ${subject(universe, filters, "manhwa, manga & manhua")}`;
}

// "romance manhwa", "seinen manhwa, manga & manhua", "roguelites"
function subject(universe: Universe, filters: TitleFilters, allReading: string) {
  return describeFilters(universe, filters, allReading) ?? (universe === "games" ? "games" : allReading);
}

function href(universe: Universe, params: RankingParams) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const query = search.toString();
  const base = universePath(universe, "/ranking");
  return query ? `${base}?${query}` : base;
}

export async function rankingMetadata(universe: Universe, searchParams: Promise<RankingParams>): Promise<Metadata> {
  const filters = parseFilters(universe, await searchParams);
  const config = UNIVERSE_CONFIG[universe];
  return {
    title: heading(universe, filters),
    description: `The ${subject(universe, filters, "manhwa, manga and manhua")} Reddit recommends most, refined by TierBase ${config.people}' tier lists. Scores out of 100.`,
    alternates: { canonical: href(universe, filterParams(filters)) },
  };
}

async function Heading({ universe, searchParams }: { universe: Universe; searchParams: Promise<RankingParams> }) {
  return <h1>{heading(universe, parseFilters(universe, await searchParams))}</h1>;
}

async function RankingList({ universe, searchParams }: { universe: Universe; searchParams: Promise<RankingParams> }) {
  const params = await searchParams;
  const filter = parseFilters(universe, params);
  const config = UNIVERSE_CONFIG[universe];
  const query = params.q?.trim().slice(0, 80) ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const { titles: visible, total } = await getRankingPage({
    universe,
    kind: filter.kind,
    genre: filter.genre?.name,
    query: query || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <div className="toolbar">
        <form className="search-form" action={universePath(universe, "/ranking")}>
          {filter.kind && <input type="hidden" name="kind" value={filter.kind} />}
          {filter.genre && <input type="hidden" name="genre" value={filter.genre.slug} />}
          <input className="search" type="search" name="q" placeholder="Search the ranking…" defaultValue={params.q} />
        </form>
        <FilterChips
          universe={universe}
          active={filter}
          href={(f) => href(universe, { ...filterParams(f), q: params.q })}
        />
      </div>

      <div className="ranking-row ranking-head muted" aria-hidden>
        <span>Rank</span>
        <span />
        <span>Title</span>
        <span className="ranking-meta">Mentions</span>
        <span className="ranking-meta">{config.people[0].toUpperCase() + config.people.slice(1)}</span>
        <span className="count">Score</span>
      </div>
      <ol className="ranking">
        {visible.map((t) => (
          <li key={t.id}>
            <Link href={titleHref(t)} className="ranking-row">
              <span className="rank">#{t.rank}</span>
              <Cover src={t.cover} size="small" />
              <span className="ranking-name">
                {t.name}
                {t.year && universe === "games" && <span className="muted"> ({t.year})</span>}
              </span>
              <span className="ranking-meta muted">{t.mentions}</span>
              <span className="ranking-meta muted">
                {t.avgTier ? (
                  <>
                    <span className="tier-badge" style={{ background: `var(--tier-${t.avgTier.toLowerCase()})` }}>
                      {t.avgTier}
                    </span>{" "}
                    ({t.votes})
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className="count">{scoreOutOf100(t.score)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {total === 0 && <p className="muted">No title matches.</p>}

      <nav className="pager">
        {page > 1 && <Link href={href(universe, { ...params, page: String(page - 1) })}>← Previous</Link>}
        {page * PAGE_SIZE < total && (
          <Link href={href(universe, { ...params, page: String(page + 1) })}>Next →</Link>
        )}
      </nav>
    </>
  );
}

export default function RankingView({ universe, searchParams }: { universe: Universe; searchParams: Promise<RankingParams> }) {
  return (
    <>
      <section className="hero">
        <Suspense fallback={<h1>{heading(universe, {})}</h1>}>
          <Heading universe={universe} searchParams={searchParams} />
        </Suspense>
        <p className="muted">
          Every {universe === "games" ? "game" : "title"} starts from how often Reddit recommends it, then moves with the
          tier lists people build here. Scores are out of 100.
        </p>
      </section>
      <Suspense fallback={<RankingSkeleton />}>
        <RankingList universe={universe} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
