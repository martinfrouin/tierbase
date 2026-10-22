import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import { getRanking, KINDS, scoreOutOf100, type Kind } from "@/lib/data";
import { parseKind } from "@/lib/kinds";

// "Best manhwa" is the search people make: each kind filter gets its own title and canonical URL
function heading(kind: Kind | undefined) {
  return kind ? `Best ${kind}` : "Best manhwa, manga & manhua";
}

export async function generateMetadata({ searchParams }: PageProps<"/ranking">): Promise<Metadata> {
  const kind = parseKind((await searchParams).kind as string | undefined) ?? undefined;
  return {
    title: heading(kind),
    description: `The ${kind ?? "manhwa, manga and manhua"} Reddit recommends most, refined by TierBase readers' tier lists. Scores out of 100.`,
    alternates: { canonical: kind ? `/ranking?kind=${kind}` : "/ranking" },
  };
}

async function Heading({ searchParams }: { searchParams: Promise<Params> }) {
  return <h1>{heading(parseKind((await searchParams).kind) ?? undefined)}</h1>;
}

const PAGE_SIZE = 50;

type Params = { kind?: string; q?: string; page?: string };

function href(params: Params) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const query = search.toString();
  return query ? `/ranking?${query}` : "/ranking";
}

async function RankingList({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const kind = KINDS.some((k) => k.value === params.kind) ? (params.kind as Kind) : undefined;
  const query = params.q?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const all = await getRanking(kind);
  const filtered = all.filter((t) => !query || t.name.toLowerCase().includes(query));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="toolbar">
        <form className="search-form" action="/ranking">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <input className="search" type="search" name="q" placeholder="Search the ranking…" defaultValue={params.q} />
        </form>
        <div className="chips">
          <Link className={kind ? "chip" : "chip active"} href={href({ q: params.q })}>
            All
          </Link>
          {KINDS.map((k) => (
            <Link key={k.value} className={kind === k.value ? "chip active" : "chip"} href={href({ kind: k.value, q: params.q })}>
              {k.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="ranking-row ranking-head muted" aria-hidden>
        <span>Rank</span>
        <span />
        <span>Title</span>
        <span className="ranking-meta">Mentions</span>
        <span className="ranking-meta">Readers</span>
        <span className="count">Score</span>
      </div>
      <ol className="ranking">
        {visible.map((t) => (
          <li key={t.id}>
            <Link href={`/title/${t.slug}`} className="ranking-row">
              <span className="rank">#{t.rank}</span>
              <Cover src={t.cover} size="small" />
              <span className="ranking-name">{t.name}</span>
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
        {page > 1 && <Link href={href({ ...params, page: String(page - 1) })}>← Previous</Link>}
        {page * PAGE_SIZE < filtered.length && <Link href={href({ ...params, page: String(page + 1) })}>Next →</Link>}
      </nav>
    </>
  );
}

export default function RankingPage({ searchParams }: PageProps<"/ranking">) {
  return (
    <>
      <section className="hero">
        <Suspense fallback={<h1>{heading(undefined)}</h1>}>
          <Heading searchParams={searchParams as Promise<Params>} />
        </Suspense>
        <p className="muted">
          Every title starts from how often Reddit recommends it, then moves with the tier lists people build here. Scores
          are out of 100.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading the ranking…</p>}>
        <RankingList searchParams={searchParams as Promise<Params>} />
      </Suspense>
    </>
  );
}
