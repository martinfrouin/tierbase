import { ImageResponse } from "next/og";
import { getLibrary, getUserByShareId } from "@/lib/data";
import { parseKind } from "@/lib/kinds";
import { DOWNLOAD_LAYOUT, imageHeight, TierImage, WIDTH } from "@/lib/tier-image";

// Full tier list as a PNG to post on Discord, X or TikTok: every cover, with the site's address at the bottom
export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const owner = await getUserByShareId((await params).shareId);
  if (!owner) return new Response("Not found", { status: 404 });
  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  const list = (await getLibrary(owner.id)).filter((e) => e.tier && (!kind || e.title.kind === kind));
  const filename = kind ? `${kind}-tier-list` : "tier-list";

  return new ImageResponse(<TierImage list={list} layout={DOWNLOAD_LAYOUT} />, {
    width: WIDTH,
    height: imageHeight(list, DOWNLOAD_LAYOUT),
    headers: { "Content-Disposition": `inline; filename="${filename}.png"`, "Cache-Control": "no-store" },
  });
}
