import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import TierBoard from "@/components/TierBoard";
import { getLibrary, getRanking, getShareId, type Tier } from "@/lib/data";
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

  const shareId = userId ? await getShareId(userId) : null;
  const host = (await headers()).get("host");
  const shareUrl = shareId && host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/tierlist/${shareId}` : undefined;

  return <TierBoard placed={placed} pool={[...wantToRead, ...popular]} editable shareUrl={shareUrl} />;
}

export default function TierListPage() {
  return (
    <>
      <section className="hero">
        <h1>My tier list</h1>
        <p className="muted">
          Every title you place here improves your recommendations and moves the global ranking. Share it or paste it on
          Reddit.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading your tier list…</p>}>
        <MyBoard />
      </Suspense>
    </>
  );
}
