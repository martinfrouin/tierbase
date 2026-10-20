import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import ListName from "@/components/ListName";
import TierBoard from "@/components/TierBoard";
import { getLibrary, getRanking, getShareInfo, type Tier } from "@/lib/data";
import { currentUserId } from "@/lib/user";

export const metadata: Metadata = { title: "My tier list" };

const POOL_SIZE = 60;

async function MyBoard() {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId) : [];
  const placed = library.filter((e) => e.tier).map((e) => ({ title: e.title, tier: e.tier as Tier }));
  const inLibrary = new Set(library.map((e) => e.title.id));

  const wantToRead = library.filter((e) => e.state === "want").map((e) => e.title);
  const popular = (await getRanking()).filter((t) => !inLibrary.has(t.id)).slice(0, POOL_SIZE);

  const share = userId ? await getShareInfo(userId) : null;
  const host = (await headers()).get("host");
  const shareUrl =
    share && host
      ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/tierlist/${share.shareId}`
      : undefined;

  return (
    <>
      {share && <ListName initial={share.listName} />}
      <TierBoard placed={placed} wantToRead={wantToRead} pool={popular} editable shareUrl={shareUrl} />
    </>
  );
}

export default function TierListPage() {
  return (
    <>
      <section className="hero">
        <h1>My tier list</h1>
        <p className="muted">
          This is what your recommendations are built on: the more titles you rank, the better they get. Drag in what
          you&apos;ve read, then <Link href="/for-you">see your recommendations</Link>. You can also share it or paste
          it on Reddit.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading your tier list…</p>}>
        <MyBoard />
      </Suspense>
    </>
  );
}
