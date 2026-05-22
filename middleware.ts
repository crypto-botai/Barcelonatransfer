import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // ── Unauthenticated → login ──────────────────────────────────
  if (!token) {
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/driver")
    ) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const role = token.role as string | undefined;

  // ── Already logged-in users hitting /auth/login → redirect to their dashboard ─
  if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
    if (role === "DRIVER") return NextResponse.redirect(new URL("/driver", req.url));
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── ADMIN routes ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") {
      if (role === "DRIVER") return NextResponse.redirect(new URL("/driver", req.url));
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // ── DRIVER routes ────────────────────────────────────────────
  if (pathname.startsWith("/driver")) {
    if (role !== "DRIVER") {
      if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // ── USER dashboard ───────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
    if (role === "DRIVER") return NextResponse.redirect(new URL("/driver", req.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/driver/:path*",
    "/auth/login",
    "/auth/register",
  ],
};
