import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import { getRankedGenreCounts, getRanking, KINDS, scoreOutOf100, type Kind } from "@/lib/data";
import { GAME_GENRES, parseGenre, type GameGenre } from "@/lib/game-genres";
import { parseKind } from "@/lib/kinds";
import { titleHref, UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";

export type RankingParams = { kind?: string; genre?: string; q?: string; page?: string };

const PAGE_SIZE = 50;
// A genre filter needs enough games to make a ranking worth opening
const MIN_GENRE_TITLES = 5;

interface Filter {
  kind?: Kind;
  genre?: GameGenre;
}

function parseFilter(universe: Universe, params: RankingParams): Filter {
  if (universe === "reading") return { kind: parseKind(params.kind) ?? undefined };
  return { genre: parseGenre(params.genre) ?? undefined };
}

// "Best manhwa" and "Best roguelites" are the searches people make: each filter gets its own title and canonical URL
function heading(universe: Universe, { kind, genre }: Filter) {
  if (universe === "reading") return kind ? `Best ${kind}` : "Best manhwa, manga & manhua";
  return genre ? `Best ${genre.plural}` : "Best games";
}

function href(universe: Universe, params: RankingParams) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const query = search.toString();
  const base = universePath(universe, "/ranking");
  return query ? `${base}?${query}` : base;
}

export async function rankingMetadata(universe: Universe, searchParams: Promise<RankingParams>): Promise<Metadata> {
  const filter = parseFilter(universe, await searchParams);
  const config = UNIVERSE_CONFIG[universe];
  const subject =
    universe === "reading" ? (filter.kind ?? "manhwa, manga and manhua") : (filter.genre?.plural ?? "games");
  return {
    title: heading(universe, filter),
    description: `The ${subject} Reddit recommends most, refined by TierBase ${config.people}' tier lists. Scores out of 100.`,
    alternates: {
      canonical: href(universe, filter.kind ? { kind: filter.kind } : filter.genre ? { genre: filter.genre.slug } : {}),
    },
  };
}

async function Heading({ universe, searchParams }: { universe: Universe; searchParams: Promise<RankingParams> }) {
  return <h1>{heading(universe, parseFilter(universe, await searchParams))}</h1>;
}

async function FilterChips({ universe, params, filter }: { universe: Universe; params: RankingParams; filter: Filter }) {
  if (universe === "reading") {
    return (
      <div className="chips">
        <Link className={filter.kind ? "chip" : "chip active"} href={href(universe, { q: params.q })}>
          All
        </Link>
        {KINDS.map((k) => (
          <Link
            key={k.value}
            className={filter.kind === k.value ? "chip active" : "chip"}
            href={href(universe, { kind: k.value, q: params.q })}
          >
            {k.label}
          </Link>
        ))}
      </div>
    );
  }
  const counts = await getRankedGenreCounts(universe);
  const genres = GAME_GENRES.filter((g) => (counts.get(g.name) ?? 0) >= MIN_GENRE_TITLES || g === filter.genre);
  return (
    <div className="chips">
      <Link className={filter.genre ? "chip" : "chip active"} href={href(universe, { q: params.q })}>
        All
      </Link>
      {genres.map((g) => (
        <Link
          key={g.slug}
          className={filter.genre === g ? "chip active" : "chip"}
          href={href(universe, { genre: g.slug, q: params.q })}
        >
          {g.name}
        </Link>
      ))}
    </div>
  );
}

async function RankingList({ universe, searchParams }: { universe: Universe; searchParams: Promise<RankingParams> }) {
  const params = await searchParams;
  const filter = parseFilter(universe, params);
  const config = UNIVERSE_CONFIG[universe];
  const query = params.q?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const all = await getRanking({ universe, kind: filter.kind, genre: filter.genre?.name });
  const filtered = all.filter((t) => !query || t.name.toLowerCase().includes(query));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="toolbar">
        <form className="search-form" action={universePath(universe, "/ranking")}>
          {filter.kind && <input type="hidden" name="kind" value={filter.kind} />}
          {filter.genre && <input type="hidden" name="genre" value={filter.genre.slug} />}
          <input className="search" type="search" name="q" placeholder="Search the ranking…" defaultValue={params.q} />
        </form>
        <FilterChips universe={universe} params={params} filter={filter} />
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
      {filtered.length === 0 && <p className="muted">No title matches.</p>}

      <nav className="pager">
        {page > 1 && <Link href={href(universe, { ...params, page: String(page - 1) })}>← Previous</Link>}
        {page * PAGE_SIZE < filtered.length && (
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
      <Suspense fallback={<p className="muted">Loading the ranking…</p>}>
        <RankingList universe={universe} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
