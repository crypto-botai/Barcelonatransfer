import { MetadataRoute } from "next";

const DISALLOW = [
  "/admin",
  "/driver",
  "/dashboard",
  "/api",
  "/auth/",
  "/booking/pay/",
  "/book/success",
  "/book/failed",
  "/review",
];

// Every bot listed explicitly must repeat the disallow list —
// a specific user-agent block fully replaces the wildcard (*) block for that agent.
function botRule(userAgent: string): MetadataRoute.Robots["rules"][number] {
  return { userAgent, allow: "/", disallow: DISALLOW };
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Wildcard — base rule for all crawlers not listed below
      { userAgent: "*", allow: "/", disallow: DISALLOW },

      // ── Traditional search crawlers ──────────────────────────────────
      botRule("Googlebot"),
      botRule("Bingbot"),
      botRule("Slurp"),           // Yahoo
      botRule("DuckDuckBot"),
      botRule("Baiduspider"),
      botRule("YandexBot"),
      botRule("Applebot"),
      botRule("facebookexternalhit"),
      botRule("LinkedInBot"),
      botRule("Twitterbot"),

      // ── OpenAI / ChatGPT ─────────────────────────────────────────────
      botRule("GPTBot"),
      botRule("ChatGPT-User"),
      botRule("OAI-SearchBot"),

      // ── Anthropic / Claude ───────────────────────────────────────────
      botRule("ClaudeBot"),
      botRule("Claude-User"),
      botRule("anthropic-ai"),

      // ── Google AI (Gemini / AI Overviews) ───────────────────────────
      botRule("Google-Extended"),

      // ── Perplexity AI ────────────────────────────────────────────────
      botRule("PerplexityBot"),

      // ── Meta AI (Llama) ──────────────────────────────────────────────
      botRule("Meta-ExternalAgent"),
      botRule("meta-externalfetcher"),

      // ── Apple Intelligence ───────────────────────────────────────────
      botRule("Applebot-Extended"),

      // ── Amazon Alexa / AWS AI ────────────────────────────────────────
      botRule("Amazonbot"),

      // ── Cohere AI ────────────────────────────────────────────────────
      botRule("cohere-ai"),

      // ── You.com ──────────────────────────────────────────────────────
      botRule("YouBot"),

      // ── TikTok / ByteDance ───────────────────────────────────────────
      botRule("Bytespider"),

      // ── Diffbot ──────────────────────────────────────────────────────
      botRule("Diffbot"),

      // ── Common Crawl ─────────────────────────────────────────────────
      botRule("CCBot"),

      // ── Other AI search engines ──────────────────────────────────────
      botRule("Timpibot"),
      botRule("iaskspider"),
      botRule("Brave"),
    ],
    sitemap: "https://www.elitebcn.info/sitemap.xml",
    host:    "https://www.elitebcn.info",
  };
}
