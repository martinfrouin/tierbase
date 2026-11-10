import HomeView, { type HomeParams } from "@/views/HomeView";

export default function Home({ searchParams }: { searchParams: Promise<HomeParams> }) {
  return <HomeView universe="reading" searchParams={searchParams} />;
}
