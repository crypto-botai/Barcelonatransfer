import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/driver", "/dashboard", "/api", "/auth/", "/booking/pay/"],
      },
      // Explicitly allow AI crawlers to index content for GEO/AI citation
      { userAgent: "GPTBot",        allow: "/" },
      { userAgent: "ChatGPT-User",  allow: "/" },
      { userAgent: "anthropic-ai",  allow: "/" },
      { userAgent: "ClaudeBot",     allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Googlebot",     allow: "/" },
      { userAgent: "Bingbot",       allow: "/" },
    ],
    sitemap: "https://www.elitebcn.info/sitemap.xml",
  };
}
