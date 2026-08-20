import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSS was inlined into <style> to avoid a render-blocking stylesheet
    // request. That was the right call when the bundle was ~15 KiB, which is
    // what the note here used to say.
    //
    // It has since grown to 89 KB, and Next writes it into the RSC payload
    // twice on top of the <style> tag — about 270 KB of CSS in every document,
    // re-sent on every page and impossible to cache. A destination page went
    // from 378 KB to 106 KB with this off.
    //
    // The cost is one render-blocking request on the first page. It is served
    // gzipped at ~15 KB and then cached for the rest of the visit, which is the
    // better trade for a site people browse several pages of.
    inlineCss: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
    // No image on the site is ever displayed above ~900px even at 2x DPR inside
    // the capped content container — Next's default deviceSizes goes up to 3840,
    // which was the source of every fleet card requesting a 3840px image for a
    // ~400px card. Trimmed to the range this site actually uses.
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Permanent redirect: non-www → www (belt-and-suspenders on top of Vercel CDN redirect)
  // Ensures Google always sees a single canonical domain regardless of request origin
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "elitebcn.info" }],
        destination: "https://www.elitebcn.info/:path*",
        permanent: true,
      },
      // Legacy slug: electric-vehicle → canonical eqe-300-electric
      {
        source:      "/fleet/electric-vehicle",
        destination: "/fleet/eqe-300-electric",
        permanent:   true,
      },
      // Removed Tesla Model S from fleet — redirect to EQE 300 Electric page
      {
        source:      "/fleet/tesla-model-s",
        destination: "/fleet/eqe-300-electric",
        permanent:   true,
      },
      // Castelldefels had two live URLs for the same destination: this
      // programmatic one and the hand-built /transfers/castelldefels page.
      // Duplicate content, and the -transfer variant had no inbound links.
      {
        source:      "/transfers/castelldefels-transfer",
        destination: "/transfers/castelldefels",
        permanent:   true,
      },
    ];
  },

  // Block crawling on Vercel preview / development deployments so Google
  // never sees a page with canonical pointing to production and calls it
  // "Alternative page with proper canonical tag".
  // Also noindex admin/auth routes on production — they must never appear in search results.
  async headers() {
    const isProd = process.env.VERCEL_ENV === "production";
    const result = [];

    if (!isProd) {
      result.push({
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      });
    }

    // Always noindex admin/auth/api on production
    result.push(
      { source: "/admin/:path*",     headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/auth/:path*",      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/driver/:path*",    headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/dashboard/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    );

    // Baseline security headers on every response.
    //
    // Only Strict-Transport-Security was being sent. These four are the rest of
    // the standard set, and they matter here specifically: the site takes names,
    // phone numbers and addresses on the booking form and hands off to a payment
    // provider, so it should not be frameable by a third party, should not leak
    // full booking URLs in the Referer when a customer follows an outbound link,
    // and should not let a browser second-guess a declared content type.
    result.push({
      source: "/:path*",
      headers: [
        // Never let the browser guess a type we did not declare.
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Nobody frames this site. Clickjacking a booking form is the concern;
        // the payment step embeds SumUp rather than the other way round, so
        // same-origin framing is all that is ever needed.
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        // Send the origin to other sites, the full path only to ourselves — so a
        // tracking link cannot learn a customer's booking reference.
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Camera and microphone are denied outright; nothing here uses them.
        //
        // Payment is NOT denied. SumUp's card widget mounts in-page from
        // gateway.sumup.com and needs the Payment Request API for Apple Pay and
        // Google Pay, so denying it would break checkout for exactly the
        // customers most likely to complete it. Self and SumUp are allowed and
        // everyone else is not.
        {
          key: "Permissions-Policy",
          value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://gateway.sumup.com")',
        },
      ],
    });

    // Explicit Content-Type for sitemap and robots so no proxy/CDN can misidentify them.
    // Google requires application/xml for sitemaps — this is belt-and-suspenders
    // on top of what Next.js already sets via the MetadataRoute handler.
    result.push(
      {
        source: "/fleet/:file*.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400, immutable" }],
      },
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Content-Type", value: "application/xml; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    );

    return result;
  },
};

export default nextConfig;
