import type { Metadata } from "next";
import TierListView, { tierListTitle } from "@/views/TierListView";

export const metadata: Metadata = { title: tierListTitle("games") };

export default function GamesTierListPage({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  return <TierListView universe="games" searchParams={searchParams} />;
}
