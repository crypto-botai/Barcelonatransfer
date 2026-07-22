import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/driver", "/dashboard", "/api", "/auth/", "/booking/pay/"],
      },
      // Explicitly allow AI crawlers for GEO / AI citation visibility
      { userAgent: "GPTBot",          allow: "/" },
      { userAgent: "ChatGPT-User",    allow: "/" },
      { userAgent: "Claude-User",     allow: "/" },
      { userAgent: "anthropic-ai",    allow: "/" },
      { userAgent: "ClaudeBot",       allow: "/" },
      { userAgent: "PerplexityBot",   allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "CCBot",           allow: "/" },
      { userAgent: "Googlebot",       allow: "/" },
      { userAgent: "Bingbot",         allow: "/" },
    ],
    sitemap: "https://www.elitebcn.info/sitemap.xml",
  };
}
