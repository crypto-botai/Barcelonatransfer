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
    ];
  },

  // Block crawling on Vercel preview / development deployments so Google
  // never sees a page with canonical pointing to production and calls it
  // "Alternative page with proper canonical tag"
  async headers() {
    if (process.env.VERCEL_ENV === "production") return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
