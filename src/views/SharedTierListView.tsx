import type { Metadata } from "next";
import { ImageResponse } from "next/og";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import {
  getLibrary,
  getUserByShareId,
  recommend,
  tasteMatch,
  TIER_WEIGHT,
  TIERS,
  userBasket,
  type LibraryEntry,
} from "@/lib/data";
import { filtersInUse, matchesFilter, parseListFilter, type ListFilter } from "@/lib/list-filters";
import { DOWNLOAD_LAYOUT, imageHeight, OG_LAYOUT, TierImage, WIDTH } from "@/lib/tier-image";
import { titleHref, UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";
import { currentUserId } from "@/lib/user";

export const TIER_OG_SIZE = { width: 1200, height: 630 };

type FilterParams = { kind?: string; genre?: string };

// "A player's Roguelite tier list" when a games list is narrowed to one genre
function listName(universe: Universe, filter: ListFilter | null = null) {
  const genre = filter?.genre ? `${filter.label} ` : "";
  return `A ${UNIVERSE_CONFIG[universe].person}'s ${genre}tier list`;
}

export async function sharedTierListMetadata(
  universe: Universe,
  params: Promise<{ shareId: string }>,
  searchParams: Promise<FilterParams>,
): Promise<Metadata> {
  const { shareId } = await params;
  const name = listName(universe, parseListFilter(universe, await searchParams));
  const description =
    universe === "games"
      ? "See how this player ranks their games, then make your own tier list."
      : "See how this reader ranks their manga, manhwa and manhua, then make your own tier list.";
  return {
    title: name,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `${universePath(universe, "/tierlist")}/${shareId}` },
    openGraph: { title: name, description },
    twitter: { card: "summary_large_image" },
  };
}

async function Match({ universe, list, ownerId }: { universe: Universe; list: LibraryEntry[]; ownerId: string }) {
  const tierList = universePath(universe, "/tierlist");
  const viewerId = await currentUserId();
  if (viewerId === ownerId)
    return (
      <p className="match">
        This is your list. <Link href={tierList}>Edit it →</Link>
      </p>
    );

  const mine = viewerId ? await getLibrary(viewerId, universe) : [];
  const result = tasteMatch(list, mine);
  const noun = universe === "games" ? "game" : "title";
  if (!result) {
    return (
      <p className="match">
        <Link href={universePath(universe)}>Rank a few {noun}s</Link> to see how your taste compares.
      </p>
    );
  }
  return (
    <p className="match">
      <strong>{result.match}% taste match</strong> on {result.common} {noun}
      {result.common > 1 ? "s" : ""} you both ranked. <Link href={tierList}>Your tier list →</Link>
    </p>
  );
}

async function SharedList({
  universe,
  params,
  searchParams,
}: {
  universe: Universe;
  params: Promise<{ shareId: string }>;
  searchParams: Promise<FilterParams>;
}) {
  const { shareId } = await params;
  const owner = await getUserByShareId(shareId);
  if (!owner) notFound();
  const config = UNIVERSE_CONFIG[universe];
  const list = (await getLibrary(owner.id, universe)).filter((e) => e.tier);
  const filter = parseListFilter(universe, await searchParams);
  const shown = list.filter((e) => matchesFilter(filter, e.title));
  const options = filtersInUse(universe, list.map((e) => e.title));
  const liked = list.filter((e) => e.tier === "S" || e.tier === "A");
  const recs = (
    await recommend(
      liked.map((e) => ({ titleId: e.title.id, weight: TIER_WEIGHT[e.tier!] ?? 0 })),
      new Set(list.map((e) => e.title.id)),
      { limit: 40, skipBasket: userBasket(owner.id, universe) },
    )
  )
    .filter((r) => matchesFilter(filter, r.title))
    .slice(0, 6);
  const listPath = `${universePath(universe, "/tierlist")}/${shareId}`;

  return (
    <>
      <section className="hero">
        <h1>{listName(universe, filter)}</h1>
        <p className="muted">
          {shown.length} {universe === "games" ? "games" : "titles"} ranked
        </p>
        <Suspense fallback={<p className="match" />}>
          <Match universe={universe} list={list} ownerId={owner.id} />
        </Suspense>
      </section>

      {options.length > 1 && (
        <div className="chips board-filter">
          <Link className={filter ? "chip" : "chip active"} href={listPath}>
            All
          </Link>
          {options.map((f) => (
            <Link
              key={f.value}
              className={filter?.value === f.value ? "chip active" : "chip"}
              href={`${listPath}?${f.param}=${f.value}`}
            >
              {f.label}
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
                  <Link key={e.title.id} href={titleHref(e.title)} className="tier-cover" title={e.title.name}>
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
          <h2>If you like this list, {config.verb} these next</h2>
          <div className="cover-grid">
            {recs.map((r) => (
              <Link key={r.title.id} href={titleHref(r.title)} className="cover-tile">
                <Cover src={r.title.cover} size="medium" />
                <span>{r.title.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="cta">
        <Link href={universePath(universe)} className="button primary">
          Make your own tier list
        </Link>
      </p>
    </>
  );
}

export default function SharedTierListView({
  universe,
  params,
  searchParams,
}: {
  universe: Universe;
  params: Promise<{ shareId: string }>;
  searchParams: Promise<FilterParams>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <SharedList universe={universe} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// Card shown when a shared tier list link is pasted on Discord or X
export async function sharedTierListOgImage(universe: Universe, shareId: string) {
  const owner = await getUserByShareId(shareId);
  const list = owner ? (await getLibrary(owner.id, universe)).filter((e) => e.tier) : [];
  return new ImageResponse(<TierImage name={listName(universe)} list={list} layout={OG_LAYOUT} />, TIER_OG_SIZE);
}

// Full tier list as a PNG to post on Discord, X or TikTok: every cover, with the site's address at the bottom
export async function sharedTierListImage(universe: Universe, shareId: string, request: Request) {
  const owner = await getUserByShareId(shareId);
  if (!owner) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams;
  const filter = parseListFilter(universe, { kind: query.get("kind"), genre: query.get("genre") });
  const list = (await getLibrary(owner.id, universe)).filter((e) => e.tier && matchesFilter(filter, e.title));
  const filename = filter ? `${filter.name}-tier-list` : universe === "games" ? "games-tier-list" : "tier-list";

  return new ImageResponse(<TierImage list={list} layout={DOWNLOAD_LAYOUT} />, {
    width: WIDTH,
    height: imageHeight(list, DOWNLOAD_LAYOUT),
    headers: { "Content-Disposition": `inline; filename="${filename}.png"`, "Cache-Control": "no-store" },
  });
}
