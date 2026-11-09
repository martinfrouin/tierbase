import { TITLE_OG_SIZE, titleOgImage } from "@/views/title-og";

export const alt = "Title and similar reads";
export const size = TITLE_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return titleOgImage("reading", (await params).slug);
}
