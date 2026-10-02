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

  const rawToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // A token whose account no longer exists (deleted from its own settings)
  // has its id cleared by the jwt callback; treat it as signed out.
  const token = rawToken && rawToken.id ? rawToken : null;
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

  /**
   * Staff and auth routes are never indexed.
   *
   * This used to be a block that set the header and then `return`ed, which
   * meant every role rule below it was unreachable for exactly the paths the
   * rules are about: /auth, /admin, /driver, /partner, /dashboard. The visible
   * consequence was a loop. A signed-in user sent back to /auth/login by any
   * guard was supposed to be bounced on to their own panel by the rule further
   * down; that rule never ran, so they sat on the login form, signed in,
   * watching it accept their password and go nowhere.
   *
   * The header is now applied to whatever this function finally returns.
   */
  const STAFF_PREFIXES = ["/auth", "/admin", "/driver", "/partner", "/fleet-login", "/dashboard"];
  const isStaffRoute = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const noindex = (res: NextResponse) => {
    if (isStaffRoute) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  };

  // ── Signed out, on a route that needs a login ─────────────────
  // The two sign-up pages are the exception: a driver or a company registers
  // before they have any login to be sent to.
  const needsLogin = ["/admin", "/driver", "/partner", "/dashboard"].some((p) => pathname.startsWith(p));
  const publicSignUp = pathname === "/driver/register" || pathname === "/partner/register";
  if (needsLogin && !publicSignUp && !token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return noindex(NextResponse.redirect(loginUrl));
  }

  // ── Unauthenticated public routes → pass through ──────────────
  if (!token) {
    return noindex(NextResponse.next());
  }

  const role = token.role as string | undefined;

  // ── Already logged-in users hitting /auth/login → redirect to their dashboard ─
  if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) {
    if (role === "ADMIN") return noindex(NextResponse.redirect(new URL("/admin", req.url)));
    if (role === "DRIVER") return noindex(NextResponse.redirect(new URL("/driver", req.url)));
    if (role === "PARTNER") return noindex(NextResponse.redirect(new URL("/partner", req.url)));
    return noindex(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  // ── PARTNER routes ───────────────────────────────────────────
  // A fleet company's own panel. Nothing here routes into /admin, and an
  // admin does not land here either: the two are different jobs.
  if (pathname.startsWith("/partner") && !pathname.startsWith("/partner/register")) {
    // Someone signed in as a customer or a driver who opens the company
    // panel is told why it will not open, rather than being dropped on a
    // dashboard that is not the one they wanted.
    if (role !== "PARTNER") return noindex(NextResponse.redirect(new URL("/fleet-login", req.url)));
    return noindex(NextResponse.next());
  }

  // ── ADMIN routes ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") {
      if (role === "DRIVER")  return noindex(NextResponse.redirect(new URL("/driver", req.url)));
      if (role === "PARTNER") return noindex(NextResponse.redirect(new URL("/partner", req.url)));
      return noindex(NextResponse.redirect(new URL("/dashboard", req.url)));
    }
    return noindex(NextResponse.next());
  }

  // ── DRIVER routes ────────────────────────────────────────────
  if (pathname.startsWith("/driver")) {
    if (role !== "DRIVER") {
      if (role === "ADMIN")   return noindex(NextResponse.redirect(new URL("/admin", req.url)));
      if (role === "PARTNER") return noindex(NextResponse.redirect(new URL("/partner", req.url)));
      return noindex(NextResponse.redirect(new URL("/dashboard", req.url)));
    }
    return noindex(NextResponse.next());
  }

  // ── USER dashboard ───────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    // The live tracking page is the one customer page the office opens too:
    // the dispatch board and the booking drawer both link to it.
    if (role === "ADMIN" && !pathname.startsWith("/dashboard/tracking/")) return noindex(NextResponse.redirect(new URL("/admin", req.url)));
    if (role === "DRIVER")  return noindex(NextResponse.redirect(new URL("/driver", req.url)));
    if (role === "PARTNER") return noindex(NextResponse.redirect(new URL("/partner", req.url)));
    return noindex(NextResponse.next());
  }

  return noindex(NextResponse.next());
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
