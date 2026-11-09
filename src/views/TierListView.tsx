import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import RestoreLink from "@/components/RestoreLink";
import TierBoard from "@/components/TierBoard";
import { getLibrary, getRanking, getShareInfo, type Tier } from "@/lib/data";
import { UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";
import { currentUserId } from "@/lib/user";

const POOL_SIZE = 60;

export function tierListTitle(universe: Universe) {
  return universe === "games" ? "My games tier list" : "My tier list";
}

async function MyBoard({ universe }: { universe: Universe }) {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId, universe) : [];
  const placed = library.filter((e) => e.tier).map((e) => ({ title: e.title, tier: e.tier as Tier }));
  const inLibrary = new Set(library.map((e) => e.title.id));

  const wanted = library.filter((e) => e.state === "want").map((e) => e.title);
  const popular = (await getRanking({ universe })).filter((t) => !inLibrary.has(t.id)).slice(0, POOL_SIZE);

  const share = userId ? await getShareInfo(userId) : null;
  const host = (await headers()).get("host");
  const shareUrl =
    share && host
      ? `${host.startsWith("localhost") ? "http" : "https"}://${host}${universePath(universe, "/tierlist")}/${share.shareId}`
      : undefined;

  return (
    <>
      <TierBoard
        // The board keeps local state, and Next keeps visited pages mounted: remount it when the saved list changes
        key={library.map((e) => `${e.title.id}:${e.tier ?? e.state}`).join(",")}
        placed={placed}
        wantToRead={wanted}
        pool={popular}
        editable
        shareUrl={shareUrl}
        universe={universe}
      />
      {library.length > 0 && <RestoreLink />}
    </>
  );
}

async function RestoreNotice({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  const { restore } = await searchParams;
  if (restore === "ok") return <p className="notice">Welcome back: your tier list is restored on this browser.</p>;
  if (restore === "invalid") return <p className="notice">This restore link doesn&apos;t match any tier list.</p>;
  return null;
}

export default function TierListView({
  universe,
  searchParams,
}: {
  universe: Universe;
  searchParams: Promise<{ restore?: string }>;
}) {
  const config = UNIVERSE_CONFIG[universe];
  return (
    <>
      <Suspense>
        <RestoreNotice searchParams={searchParams} />
      </Suspense>
      <section className="hero">
        <h1>{tierListTitle(universe)}</h1>
        <p className="muted">
          This is what your recommendations are built on: the more {universe === "games" ? "games" : "titles"} you
          rank, the better they get. Drag in what you&apos;ve {config.past}, then{" "}
          <Link href={universePath(universe)}>see your recommendations</Link>. You can also share it as a link or an
          image.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading your tier list…</p>}>
        <MyBoard universe={universe} />
      </Suspense>
    </>
  );
}
