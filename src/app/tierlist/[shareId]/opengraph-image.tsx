import { sharedTierListOgImage, TIER_OG_SIZE } from "@/views/SharedTierListView";

export const alt = "Tier list";
export const size = TIER_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  return sharedTierListOgImage("reading", (await params).shareId);
}
