import { sharedTierListImage } from "@/views/SharedTierListView";

export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  return sharedTierListImage("games", (await params).shareId, request);
}
