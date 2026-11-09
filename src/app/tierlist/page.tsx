import type { Metadata } from "next";
import TierListView, { tierListTitle } from "@/views/TierListView";

export const metadata: Metadata = { title: tierListTitle("reading") };

export default function TierListPage({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  return <TierListView universe="reading" searchParams={searchParams} />;
}
