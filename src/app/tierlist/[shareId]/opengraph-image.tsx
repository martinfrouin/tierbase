import { ImageResponse } from "next/og";
import { getLibrary, getUserByShareId } from "@/lib/data";
import { OG_LAYOUT, TierImage } from "@/lib/tier-image";

export const alt = "Tier list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const owner = await getUserByShareId((await params).shareId);
  const list = owner ? (await getLibrary(owner.id)).filter((e) => e.tier) : [];

  return new ImageResponse(<TierImage name="A reader's tier list" list={list} layout={OG_LAYOUT} />, size);
}
