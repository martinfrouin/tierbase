import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import TierBoard from "@/components/TierBoard";
import { getLibrary, getUserByShareId, type Tier } from "@/lib/data";

export const metadata: Metadata = { title: "Shared tier list" };

async function SharedBoard({ params }: { params: Promise<{ shareId: string }> }) {
  const userId = await getUserByShareId((await params).shareId);
  if (!userId) notFound();
  const placed = (await getLibrary(userId)).filter((e) => e.tier).map((e) => ({ title: e.title, tier: e.tier as Tier }));
  return <TierBoard placed={placed} pool={[]} editable={false} />;
}

export default function SharedTierListPage({ params }: PageProps<"/tierlist/[shareId]">) {
  return (
    <>
      <section className="hero">
        <h1>A reader&apos;s tier list</h1>
        <p className="muted">
          <Link href="/">Make your own</Link> and get recommendations from readers with the same taste.
        </p>
      </section>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <SharedBoard params={params} />
      </Suspense>
    </>
  );
}
