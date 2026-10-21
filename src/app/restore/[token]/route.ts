import { NextResponse, type NextRequest } from "next/server";
import { getLibrary } from "@/lib/data";
import { currentUserId, setUserCookie, userIdByRestoreToken } from "@/lib/user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await userIdByRestoreToken(token);
  if (!userId) return NextResponse.redirect(new URL("/tierlist?restore=invalid", request.url));

  const current = await currentUserId();
  if (current === userId) return NextResponse.redirect(new URL("/tierlist", request.url));
  // Switching would leave the list already on this browser unreachable: ask first
  if (current && (await getLibrary(current)).length) {
    return NextResponse.redirect(new URL(`/restore/${token}/confirm`, request.url));
  }

  await setUserCookie(userId);
  return NextResponse.redirect(new URL("/tierlist?restore=ok", request.url));
}
