import RankingView, { rankingMetadata, type RankingParams } from "@/views/RankingView";

export function generateMetadata({ searchParams }: PageProps<"/ranking">) {
  return rankingMetadata("reading", searchParams as Promise<RankingParams>);
}

export default function RankingPage({ searchParams }: PageProps<"/ranking">) {
  return <RankingView universe="reading" searchParams={searchParams as Promise<RankingParams>} />;
}
