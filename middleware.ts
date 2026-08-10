import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { shouldForcePasswordChange } from "@/lib/auth-gates";

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

  // ── Force password change for anyone issued a temporary one ──────
  //
  // This runs before everything else because the staff-route block below
  // returns early, and /driver and /dashboard are exactly where someone lands
  // after signing in with a temporary password.
  //
  // API calls are never redirected. A redirected POST arrives at the target as
  // a GET for an HTML page, so the caller gets a JSON parse error rather than a
  // result — which would have made /api/auth/change-password, the one call that
  // clears this flag, impossible to complete.
  if (shouldForcePasswordChange(pathname, token?.mustChangePassword as boolean | undefined)) {
    return NextResponse.redirect(new URL("/auth/change-password", req.url));
  }

  // Noindex all staff/auth routes — never want these in Google
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/dashboard")
  ) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    // Still enforce auth below — don't return here
    if (pathname.startsWith("/admin") || pathname.startsWith("/driver") || pathname.startsWith("/dashboard")) {
      if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/auth/login";
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return res;
  }

  // ── Unauthenticated public routes → pass through ──────────────
  if (!token) {
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
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (Next.js static chunks)
     *  - _next/image   (image optimiser)
     *  - _vercel       (Vercel internals)
     *  - sitemap.xml   (Googlebot MUST receive raw XML — never intercept)
     *  - robots.txt    (same reason)
     *  - Any file with an extension: .png .jpg .svg .ico .xml .txt .webp etc.
     *    This blanket file-extension exclusion covers sitemap.xml, robots.txt,
     *    llms.txt, llms-full.txt, all images, fonts, manifests, and any
     *    IndexNow key files — ensuring middleware never wraps them.
     */
    "/((?!_next/static|_next/image|_vercel|.*\\.(?:xml|txt|svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|otf|eot|map|json)).*)",
  ],
};
