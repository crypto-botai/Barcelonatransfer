import { MetadataRoute } from "next";
import destinations from "@/data/destinations.json";
import { BLOG_ARTICLES } from "@/lib/blog";
import { PREFIXED_LOCALES, alternatesFor } from "@/lib/i18n";

// Statically generated at build time and served straight from the CDN.
//
// This was previously force-dynamic, which meant every Googlebot fetch invoked a
// serverless function — and a cold start there is exactly what produces
// "Sitemap could not be read" in Search Console. ISR was tried before that and
// had the opposite failure (a stale/empty first response on cold start).
//
// Static is the right answer for this route: every URL comes from data that is
// fixed at build time (destinations.json, the blog registry, hard-coded pages),
// so there is nothing to regenerate per request, and a deploy refreshes it.
export const dynamic = "force-static";

const BASE = "https://www.elitebcn.info";

// Use a stable date so the sitemap XML is byte-identical on repeated crawls.
// Googlebot treats rapidly-changing lastModified as a signal to crawl more aggressively —
// a stable date avoids unnecessary crawl budget waste.
const LAST_UPDATED = new Date("2026-07-25T00:00:00.000Z");

// The hreflang set shared by the homepage and its seven translations.
// Declaring it in the sitemap as well as in the page head is what tells Google
// these are language variants of one page rather than eight competing copies.
const HOME_LANGUAGES = alternatesFor("/").languages;

export default function sitemap(): MetadataRoute.Sitemap {
  // The translated homepages. Until now they had no URL at all, so none of the
  // seven languages could be crawled or ranked.
  const localeHomes: MetadataRoute.Sitemap = PREFIXED_LOCALES.map((locale) => ({
    url: `${BASE}/${locale}`,
    lastModified: LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.9,
    alternates: { languages: HOME_LANGUAGES },
  }));

  const dynamicPages: MetadataRoute.Sitemap = destinations.map((d) => ({
    url: `${BASE}/transfers/${d.slug}`,
    lastModified: LAST_UPDATED,
    changeFrequency: d.type === "event" ? ("yearly" as const) : ("monthly" as const),
    priority: d.type === "hotel" ? 0.75 : d.type === "cruise" ? 0.8 : d.type === "event" ? 0.8 : 0.85,
  }));

  const blogPages: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [
    // ── Core pages (highest priority) ─────────────────────────────
    { url: BASE, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 1.0, alternates: { languages: HOME_LANGUAGES } },
    ...localeHomes,
    { url: `${BASE}/blog`,              lastModified: LAST_UPDATED, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${BASE}/book`,              lastModified: LAST_UPDATED, changeFrequency: "weekly",  priority: 0.95 },
    { url: `${BASE}/pricing`,           lastModified: LAST_UPDATED, changeFrequency: "weekly",  priority: 0.9  },
    { url: `${BASE}/fleet`,             lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE}/airport-transfers`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9  },

    // ── Secondary core pages ───────────────────────────────────────
    { url: `${BASE}/corporate`,         lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/hourly`,            lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/faq`,               lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/about`,             lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7  },
    { url: `${BASE}/contact`,           lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7  },

    // ── Service pages ──────────────────────────────────────────────
    { url: `${BASE}/vip-transportation`,  lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/day-tours`,           lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/hotel-transfers`,     lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },

    // ── Fleet detail pages ─────────────────────────────────────────
    { url: `${BASE}/fleet/standard-sedan`,    lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/eqe-300-electric`,  lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE}/fleet/executive-minivan`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/luxury-minivan`,    lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/group-minibus`,     lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/fleet/tesla-model-3`,     lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/business-sedan`,    lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },

    // ── Tools ──────────────────────────────────────────────────────
    { url: `${BASE}/tools/transfer-cost-calculator`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },

    // ── Destination hub + static landing pages ─────────────────────
    { url: `${BASE}/transfers`,               lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    // The airport-to-city-centre run: the most searched route on the site, and
    // until now the only major one without a page of its own.
    { url: `${BASE}/transfers/barcelona-city-centre`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/transfers/sitges`,        lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/girona`,        lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/montserrat`,    lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/lourdes`,       lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/costa-brava`,   lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/lloret-de-mar`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/cadaques`,      lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/costa-dorada`,  lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/figueres`,      lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/tossa-de-mar`,  lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/salou`,         lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/castelldefels`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/tarragona`,     lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/andorra`,       lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/cruise-port`,   lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/port-aventura`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.75 },

    // ── Dynamic programmatic SEO pages (44 destinations) ──────────
    ...blogPages,
    ...dynamicPages,

    // ── Legal (low priority) ───────────────────────────────────────
    { url: `${BASE}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`,   lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
