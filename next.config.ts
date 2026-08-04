import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline the page CSS into <style> tags instead of a render-blocking
  // <link rel="stylesheet"> request. The stylesheet is ~15 KiB — small enough
  // that inlining costs little HTML weight, and it was the only remaining
  // render-blocking resource on the critical path (Lighthouse: ~160 ms of
  // FCP/LCP delay waiting on the CSS round-trip before anything could paint).
  experimental: {
    inlineCss: true,
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
