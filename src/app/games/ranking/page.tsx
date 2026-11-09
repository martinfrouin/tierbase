import RankingView, { rankingMetadata, type RankingParams } from "@/views/RankingView";

export function generateMetadata({ searchParams }: PageProps<"/games/ranking">) {
  return rankingMetadata("games", searchParams as Promise<RankingParams>);
}

export default function GamesRankingPage({ searchParams }: PageProps<"/games/ranking">) {
  return <RankingView universe="games" searchParams={searchParams as Promise<RankingParams>} />;
}
