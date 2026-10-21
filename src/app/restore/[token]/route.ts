import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { applyRestore, findRestore, restoreOverwrites } from "@/lib/backups";
import { getLibrary, RATINGS_TAG } from "@/lib/data";
import { currentUserId, setUserCookie } from "@/lib/user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const restore = await findRestore(token);
  if (!restore) return NextResponse.redirect(new URL("/tierlist?restore=invalid", request.url));

  // Ask first when restoring would drop a list: another one on this browser, or changes made since the backup
  const current = await currentUserId();
  const replacesOtherList = current && current !== restore.owner && (await getLibrary(current)).length > 0;
  if (replacesOtherList || (await restoreOverwrites(restore))) {
    return NextResponse.redirect(new URL(`/restore/${token}/confirm`, request.url));
  }

  await applyRestore(restore);
  await setUserCookie(restore.owner);
  revalidateTag(RATINGS_TAG, "max");
  revalidatePath("/tierlist");
  return NextResponse.redirect(new URL("/tierlist?restore=ok", request.url));
}
