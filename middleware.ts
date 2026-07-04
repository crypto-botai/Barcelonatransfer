import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // Block crawling on any non-production host (Vercel preview URLs, *.vercel.app)
  // so Google never sees canonical-pointing pages on non-canonical domains
  const host = req.headers.get("host") ?? "";
  if (host !== "www.elitebcn.info" && host !== "elitebcn.info") {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

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

  const role               = token.role as string | undefined;
  const mustChangePassword = token.mustChangePassword as boolean | undefined;

  // ── Force password change for auto-created accounts ──────────
  if (mustChangePassword && !pathname.startsWith("/auth/change-password") && !pathname.startsWith("/auth/logout")) {
    return NextResponse.redirect(new URL("/auth/change-password", req.url));
  }

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
    // Run on all page routes — needed to inject X-Robots-Tag on non-production hosts.
    // Excludes static assets, Next.js internals, and image optimization endpoints.
    "/((?!_next/static|_next/image|favicon\\.svg|opengraph-image|.*\\.(?:png|jpg|jpeg|gif|ico|webp|svg|woff2?|ttf)).*)",
  ],
};
