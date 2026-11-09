import SharedTierListView, { sharedTierListMetadata } from "@/views/SharedTierListView";

export function generateMetadata({ params, searchParams }: PageProps<"/games/tierlist/[shareId]">) {
  return sharedTierListMetadata("games", params, searchParams as Promise<{ kind?: string; genre?: string }>);
}

export default function GamesSharedTierListPage({ params, searchParams }: PageProps<"/games/tierlist/[shareId]">) {
  return (
    <SharedTierListView universe="games" params={params} searchParams={searchParams as Promise<{ kind?: string; genre?: string }>} />
  );
}
