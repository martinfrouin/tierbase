import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "pr_uid";

// Push the cookie expiry back on each visit, so only abandoned accounts ever lose it
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const id = request.cookies.get(COOKIE)?.value;
  if (id) {
    response.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|restore/|favicon|covers/|.*\\.(?:png|jpg|svg|ico|xml|txt)$).*)"],
};
