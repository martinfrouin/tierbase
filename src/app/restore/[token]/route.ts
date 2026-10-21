import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { applyRestore, findRestore, restoreOverwrites } from "@/lib/backups";
import { RATINGS_TAG } from "@/lib/data";
import { currentUserId, ensureUserId } from "@/lib/user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const restore = await findRestore(token);
  if (!restore) return NextResponse.redirect(new URL("/tierlist?restore=invalid", request.url));

  // Without a cookie (fresh browser, or a link preview bot) and when a list would be replaced, ask first
  const userId = (await currentUserId()) && (await ensureUserId());
  if (!userId || (await restoreOverwrites(restore, userId))) {
    return NextResponse.redirect(new URL(`/restore/${token}/confirm`, request.url));
  }

  await applyRestore(restore, userId);
  revalidateTag(RATINGS_TAG, "max");
  revalidatePath("/tierlist");
  return NextResponse.redirect(new URL("/tierlist?restore=ok", request.url));
}
