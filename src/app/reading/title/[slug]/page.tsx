import TitleView, { titleMetadata } from "@/views/TitleView";

export function generateMetadata({ params }: PageProps<"/reading/title/[slug]">) {
  return titleMetadata("reading", params);
}

export default function TitlePage({ params }: PageProps<"/reading/title/[slug]">) {
  return <TitleView universe="reading" params={params} />;
}
