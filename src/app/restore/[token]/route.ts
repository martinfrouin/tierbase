import { NextResponse, type NextRequest } from "next/server";
import { setUserCookie, userIdByRestoreToken } from "@/lib/user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const userId = await userIdByRestoreToken((await params).token);
  if (!userId) return NextResponse.redirect(new URL("/tierlist?restore=invalid", request.url));
  await setUserCookie(userId);
  return NextResponse.redirect(new URL("/tierlist?restore=ok", request.url));
}
