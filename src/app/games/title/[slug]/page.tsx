import TitleView, { titleMetadata } from "@/views/TitleView";

export function generateMetadata({ params }: PageProps<"/games/title/[slug]">) {
  return titleMetadata("games", params);
}

export default function GamePage({ params }: PageProps<"/games/title/[slug]">) {
  return <TitleView universe="games" params={params} />;
}
