import SharedTierListView, { sharedTierListMetadata } from "@/views/SharedTierListView";

export function generateMetadata({ params, searchParams }: PageProps<"/reading/tierlist/[shareId]">) {
  return sharedTierListMetadata("reading", params, searchParams as Promise<{ kind?: string; genre?: string }>);
}

export default function SharedTierListPage({ params, searchParams }: PageProps<"/reading/tierlist/[shareId]">) {
  return (
    <SharedTierListView universe="reading" params={params} searchParams={searchParams as Promise<{ kind?: string; genre?: string }>} />
  );
}
