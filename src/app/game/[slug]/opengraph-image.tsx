import { TITLE_OG_SIZE, titleOgImage } from "@/views/title-og";

export const alt = "Game and similar games";
export const size = TITLE_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return titleOgImage("games", (await params).slug);
}
