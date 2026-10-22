import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import { getLibrary, getUserByShareId, recommend, tasteMatch, TIER_WEIGHT, TIERS, type LibraryEntry } from "@/lib/data";
import { KINDS, parseKind } from "@/lib/kinds";
import { currentUserId } from "@/lib/user";

const DEFAULT_NAME = "A reader's tier list";

export async function generateMetadata({ params }: PageProps<"/tierlist/[shareId]">): Promise<Metadata> {
  const { shareId } = await params;
  const name = DEFAULT_NAME;
  const description = "See how this reader ranks their manga, manhwa and manhua, then make your own tier list.";
  return {
    title: name,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/tierlist/${shareId}` },
    openGraph: { title: name, description },
    twitter: { card: "summary_large_image" },
  };
}

async function Match({ list, ownerId }: { list: LibraryEntry[]; ownerId: string }) {
  const viewerId = await currentUserId();
  if (viewerId === ownerId)
    return (
      <p className="match">
        This is your list. <Link href="/tierlist">Edit it →</Link>
      </p>
    );

  const mine = viewerId ? await getLibrary(viewerId) : [];
  const result = tasteMatch(list, mine);
  if (!result) {
    return (
      <p className="match">
        <Link href="/">Rank a few titles</Link> to see how your taste compares.
      </p>
    );
  }
  return (
    <p className="match">
      <strong>{result.match}% taste match</strong> on {result.common} title{result.common > 1 ? "s" : ""} you both
      ranked. <Link href="/tierlist">Your tier list →</Link>
    </p>
  );
}

async function SharedList({
  params,
  searchParams,
}: {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { shareId } = await params;
  const owner = await getUserByShareId(shareId);
  if (!owner) notFound();
  const list = (await getLibrary(owner.id)).filter((e) => e.tier);
  const kind = parseKind((await searchParams).kind);
  const shown = kind ? list.filter((e) => e.title.kind === kind) : list;
  const kindsInUse = KINDS.filter((k) => list.some((e) => e.title.kind === k.value));
  const liked = list.filter((e) => e.tier === "S" || e.tier === "A");
  const recs = (
    await recommend(
      liked.map((e) => ({ titleId: e.title.id, weight: TIER_WEIGHT[e.tier!] ?? 0 })),
      new Set(list.map((e) => e.title.id)),
      { limit: 40, skipBasket: `u:${owner.id}` },
    )
  )
    .filter((r) => !kind || r.title.kind === kind)
    .slice(0, 6);

  return (
    <>
      <section className="hero">
        <h1>{DEFAULT_NAME}</h1>
        <p className="muted">{shown.length} titles ranked</p>
        <Suspense fallback={<p className="match" />}>
          <Match list={list} ownerId={owner.id} />
        </Suspense>
      </section>

      {kindsInUse.length > 1 && (
        <div className="chips board-filter">
          <Link className={kind ? "chip" : "chip active"} href={`/tierlist/${shareId}`}>
            All
          </Link>
          {kindsInUse.map((k) => (
            <Link
              key={k.value}
              className={kind === k.value ? "chip active" : "chip"}
              href={`/tierlist/${shareId}?kind=${k.value}`}
            >
              {k.label}
            </Link>
          ))}
        </div>
      )}

      <div className="tiers visual">
        {TIERS.map((tier) => (
          <div key={tier} className="tier">
            <div className="tier-label" style={{ background: `var(--tier-${tier.toLowerCase()})` }}>
              {tier}
            </div>
            <div className="tier-items">
              {shown
                .filter((e) => e.tier === tier)
                .map((e) => (
                  <Link key={e.title.id} href={`/title/${e.title.slug}`} className="tier-cover" title={e.title.name}>
                    <Cover src={e.title.cover} size="medium" />
                    <span>{e.title.name}</span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>

      {recs.length > 0 && (
        <>
          <h2>If you like this list, read these next</h2>
          <div className="cover-grid">
            {recs.map((r) => (
              <Link key={r.title.id} href={`/title/${r.title.slug}`} className="cover-tile">
                <Cover src={r.title.cover} size="medium" />
                <span>{r.title.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="cta">
        <Link href="/" className="button primary">
          Make your own tier list
        </Link>
      </p>
    </>
  );
}

export default function SharedTierListPage({ params, searchParams }: PageProps<"/tierlist/[shareId]">) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <SharedList params={params} searchParams={searchParams as Promise<{ kind?: string }>} />
    </Suspense>
  );
}
