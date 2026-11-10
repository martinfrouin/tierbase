import HomeView, { type HomeParams } from "@/views/HomeView";

export default function GamesHome({ searchParams }: { searchParams: Promise<HomeParams> }) {
  return <HomeView universe="games" searchParams={searchParams} />;
}
