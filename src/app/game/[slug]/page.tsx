import TitleView, { titleMetadata } from "@/views/TitleView";

export function generateMetadata({ params }: PageProps<"/game/[slug]">) {
  return titleMetadata("games", params);
}

export default function GamePage({ params }: PageProps<"/game/[slug]">) {
  return <TitleView universe="games" params={params} />;
}
