import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import RestoreLink from "@/components/RestoreLink";
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
      <TierBoard
        // The board keeps local state, and Next keeps visited pages mounted: remount it when the saved list changes
        key={library.map((e) => `${e.title.id}:${e.tier ?? e.state}`).join(",")}
        placed={placed}
        wantToRead={wantToRead}
        pool={popular}
        editable
        shareUrl={shareUrl}
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

export default function TierListPage({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  return (
    <>
      <Suspense>
        <RestoreNotice searchParams={searchParams} />
      </Suspense>
      <section className="hero">
        <h1>My tier list</h1>
        <p className="muted">
          This is what your recommendations are built on: the more titles you rank, the better they get. Drag in what
          you&apos;ve read, then <Link href="/for-you">see your recommendations</Link>. You can also share it as a link
          or an image.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading your tier list…</p>}>
        <MyBoard />
      </Suspense>
    </>
  );
}
