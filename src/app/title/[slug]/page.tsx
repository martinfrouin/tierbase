import TitleView, { titleMetadata } from "@/views/TitleView";

export function generateMetadata({ params }: PageProps<"/title/[slug]">) {
  return titleMetadata("reading", params);
}

export default function TitlePage({ params }: PageProps<"/title/[slug]">) {
  return <TitleView universe="reading" params={params} />;
}
