import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/driver", "/dashboard", "/api", "/auth/", "/booking/pay/"],
      },
      // ── Traditional search crawlers ──────────────────────────────────────
      { userAgent: "Googlebot",          allow: "/" },
      { userAgent: "Bingbot",            allow: "/" },
      { userAgent: "Slurp",              allow: "/" },  // Yahoo
      { userAgent: "DuckDuckBot",        allow: "/" },
      { userAgent: "Baiduspider",        allow: "/" },
      { userAgent: "YandexBot",          allow: "/" },
      { userAgent: "Applebot",           allow: "/" },
      { userAgent: "facebookexternalhit",allow: "/" },
      { userAgent: "LinkedInBot",        allow: "/" },
      { userAgent: "Twitterbot",         allow: "/" },
      // ── AI training & retrieval crawlers ─────────────────────────────────
      // OpenAI / ChatGPT
      { userAgent: "GPTBot",             allow: "/" },
      { userAgent: "ChatGPT-User",       allow: "/" },
      { userAgent: "OAI-SearchBot",      allow: "/" },
      // Anthropic / Claude
      { userAgent: "ClaudeBot",          allow: "/" },
      { userAgent: "Claude-User",        allow: "/" },
      { userAgent: "anthropic-ai",       allow: "/" },
      // Google AI (Gemini / AI Overviews)
      { userAgent: "Google-Extended",    allow: "/" },
      // Perplexity AI
      { userAgent: "PerplexityBot",      allow: "/" },
      // Meta AI (Llama / Meta AI assistant)
      { userAgent: "Meta-ExternalAgent", allow: "/" },
      { userAgent: "meta-externalfetcher", allow: "/" },
      // Apple Intelligence
      { userAgent: "Applebot-Extended",  allow: "/" },
      // Amazon Alexa / AWS AI
      { userAgent: "Amazonbot",          allow: "/" },
      // Cohere AI
      { userAgent: "cohere-ai",          allow: "/" },
      // You.com
      { userAgent: "YouBot",             allow: "/" },
      // TikTok / ByteDance AI
      { userAgent: "Bytespider",         allow: "/" },
      // Diffbot (structured data AI)
      { userAgent: "Diffbot",            allow: "/" },
      // Common Crawl (used by many AI labs)
      { userAgent: "CCBot",              allow: "/" },
      // Timpi AI search
      { userAgent: "Timpibot",           allow: "/" },
      // Kangaroo AI
      { userAgent: "Kangaroo Bot",       allow: "/" },
      // iAsk AI
      { userAgent: "iaskspider",         allow: "/" },
      // Brave AI
      { userAgent: "Brave",              allow: "/" },
    ],
    sitemap: "https://www.elitebcn.info/sitemap.xml",
    host:    "https://www.elitebcn.info",
  };
}
