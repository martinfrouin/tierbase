import { sharedTierListOgImage, TIER_OG_SIZE } from "@/views/SharedTierListView";

export const alt = "Games tier list";
export const size = TIER_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  return sharedTierListOgImage("games", (await params).shareId);
}
