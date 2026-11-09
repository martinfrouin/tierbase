import { sharedTierListImage } from "@/views/SharedTierListView";

export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  return sharedTierListImage("reading", (await params).shareId, request);
}
