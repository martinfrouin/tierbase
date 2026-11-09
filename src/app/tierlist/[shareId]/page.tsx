import SharedTierListView, { sharedTierListMetadata } from "@/views/SharedTierListView";

export function generateMetadata({ params }: PageProps<"/tierlist/[shareId]">) {
  return sharedTierListMetadata("reading", params);
}

export default function SharedTierListPage({ params, searchParams }: PageProps<"/tierlist/[shareId]">) {
  return (
    <SharedTierListView universe="reading" params={params} searchParams={searchParams as Promise<{ kind?: string }>} />
  );
}
