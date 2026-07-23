import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
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
      { source: "/admin/:path*",  headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/auth/:path*",   headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/driver/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/dashboard/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    );

    return result;
  },
};

export default nextConfig;
