import { MetadataRoute } from "next";
import destinations from "@/data/destinations.json";
import { BLOG_ARTICLES } from "@/lib/blog";
import { PREFIXED_LOCALES, alternatesFor } from "@/lib/i18n";
import { FLEET_PAGE } from "@/lib/fleet-pages";

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

// The default for a page that has not changed.
//
// A stable date keeps the sitemap XML byte-identical between crawls, and
// Googlebot reads a lastModified that moves on every build as a reason to crawl
// harder for no benefit. That default stands.
//
// What it cannot do is describe a page that genuinely did change. Every URL
// carried this date, so /transfers/barcelona-city-centre — published on 24
// August — advertised 25 July, understating its freshness by a month. Blog
// posts already avoided this by reading their own updatedAt; RELEASES extends
// the same idea to pages.
const LAST_UPDATED = new Date("2026-07-25T00:00:00.000Z");

/**
 * Pages that were created or materially changed after LAST_UPDATED.
 *
 * Grouped by the deploy that changed them, so the list reads as a history and a
 * reviewer can see why each date is what it is. A path absent from here keeps
 * LAST_UPDATED, which is most of the site and is the point: this stays
 * deterministic between builds, and nothing here moves unless someone edits it.
 *
 * "Materially changed" means the page says something different to a reader —
 * new sections, or a corrected price. It does not mean an added internal link;
 * bumping dates for those would be the constantly-shifting sitemap this design
 * exists to avoid.
 *
 * Adding a page to the site means adding a line here. That is deliberate: the
 * alternative is deriving dates from git or the filesystem, neither of which
 * survives a CI checkout intact.
 */
const RELEASES: ReadonlyArray<{ date: string; paths: readonly string[] }> = [
  {
    // Locale homepages published; each language got a real URL for the first time.
    date: "2026-08-21",
    paths: PREFIXED_LOCALES.map((l) => `/${l}`),
  },
  {
    // The airport-to-city-centre page, and the four pages that were rewritten
    // from a few hundred words to a full one.
    date: "2026-08-24",
    paths: [
      "/transfers/barcelona-city-centre",
      "/about",
      "/contact",
      "/corporate",
      ...Object.values(FLEET_PAGE).map((slug) => `/fleet/${slug}`),
    ],
  },
  {
    // Destination pages whose published fares were corrected: twenty hotel and
    // cruise pages quoted €45 against a real €50, and the F1 page €55 against
    // €98. A changed price is exactly what lastModified exists to signal.
    date: "2026-08-25",
    paths: [
      "/transfers/w-barcelona-hotel", "/transfers/hotel-arts-barcelona",
      "/transfers/mandarin-oriental-barcelona", "/transfers/hotel-el-palace-barcelona",
      "/transfers/majestic-hotel-barcelona", "/transfers/cotton-house-hotel-barcelona",
      "/transfers/four-seasons-barcelona", "/transfers/fairmont-rey-juan-carlos",
      "/transfers/hilton-diagonal-mar", "/transfers/sofia-hotel-barcelona",
      "/transfers/almanac-barcelona", "/transfers/hotel-1898-barcelona",
      "/transfers/barcelo-raval", "/transfers/hotel-condes-barcelona",
      "/transfers/ayre-hotel-rosellon", "/transfers/nobu-hotel-barcelona",
      "/transfers/celebrity-cruises-barcelona", "/transfers/princess-cruises-barcelona",
      "/transfers/carnival-cruises-barcelona", "/transfers/cunard-barcelona",
      "/transfers/primavera-sound-2026", "/transfers/f1-spanish-grand-prix",
    ],
  },
  {
    // Four new commercial route pages for zones that were priced but pageless,
    // plus the hubs and the price table that gained links down to them.
    date: "2026-08-26",
    paths: [
      "/transfers/la-roca-village",
      "/transfers/sants-station",
      "/transfers/vilanova",
      "/transfers/begur",
      "/airport-transfers",
      "/transfers/costa-brava",
      "/transfers/costa-dorada",
      "/pricing",
    ],
  },
];

/** path -> date, flattened once. A later release wins if a path repeats. */
const LAST_MODIFIED: ReadonlyMap<string, Date> = new Map(
  RELEASES.flatMap(({ date, paths }) =>
    paths.map((path) => [path, new Date(`${date}T00:00:00.000Z`)] as const),
  ),
);

/** The lastModified for a path, or the stable default when it has not changed. */
function lastMod(path: string): Date {
  return LAST_MODIFIED.get(path) ?? LAST_UPDATED;
}

// The hreflang set shared by the homepage and its seven translations.
// Declaring it in the sitemap as well as in the page head is what tells Google
// these are language variants of one page rather than eight competing copies.
const HOME_LANGUAGES = alternatesFor("/").languages;

export default function sitemap(): MetadataRoute.Sitemap {
  // The translated homepages. Until now they had no URL at all, so none of the
  // seven languages could be crawled or ranked.
  const localeHomes: MetadataRoute.Sitemap = PREFIXED_LOCALES.map((locale) => ({
    url: `${BASE}/${locale}`,
    lastModified: lastMod(`/${locale}`),
    changeFrequency: "weekly" as const,
    priority: 0.9,
    alternates: { languages: HOME_LANGUAGES },
  }));

  const dynamicPages: MetadataRoute.Sitemap = destinations.map((d) => ({
    url: `${BASE}/transfers/${d.slug}`,
    lastModified: lastMod(`/transfers/${d.slug}`),
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
    { url: BASE, lastModified: lastMod("/"), changeFrequency: "weekly", priority: 1.0, alternates: { languages: HOME_LANGUAGES } },
    ...localeHomes,
    { url: `${BASE}/blog`,              lastModified: lastMod("/blog"), changeFrequency: "weekly",  priority: 0.85 },
    { url: `${BASE}/book`,              lastModified: lastMod("/book"), changeFrequency: "weekly",  priority: 0.95 },
    { url: `${BASE}/pricing`,           lastModified: lastMod("/pricing"), changeFrequency: "weekly",  priority: 0.9  },
    { url: `${BASE}/fleet`,             lastModified: lastMod("/fleet"), changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE}/airport-transfers`, lastModified: lastMod("/airport-transfers"), changeFrequency: "monthly", priority: 0.9  },

    // ── Secondary core pages ───────────────────────────────────────
    { url: `${BASE}/corporate`,         lastModified: lastMod("/corporate"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/hourly`,            lastModified: lastMod("/hourly"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/faq`,               lastModified: lastMod("/faq"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/about`,             lastModified: lastMod("/about"), changeFrequency: "monthly", priority: 0.7  },
    { url: `${BASE}/contact`,           lastModified: lastMod("/contact"), changeFrequency: "monthly", priority: 0.7  },

    // ── Service pages ──────────────────────────────────────────────
    { url: `${BASE}/vip-transportation`,  lastModified: lastMod("/vip-transportation"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/day-tours`,           lastModified: lastMod("/day-tours"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/hotel-transfers`,     lastModified: lastMod("/hotel-transfers"), changeFrequency: "monthly", priority: 0.85 },

    // ── Fleet detail pages ─────────────────────────────────────────
    { url: `${BASE}/fleet/standard-sedan`,    lastModified: lastMod("/fleet/standard-sedan"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/eqe-300-electric`,  lastModified: lastMod("/fleet/eqe-300-electric"), changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE}/fleet/executive-minivan`, lastModified: lastMod("/fleet/executive-minivan"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/luxury-minivan`,    lastModified: lastMod("/fleet/luxury-minivan"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/group-minibus`,     lastModified: lastMod("/fleet/group-minibus"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/fleet/tesla-model-3`,     lastModified: lastMod("/fleet/tesla-model-3"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/fleet/business-sedan`,    lastModified: lastMod("/fleet/business-sedan"), changeFrequency: "monthly", priority: 0.85 },

    // ── Tools ──────────────────────────────────────────────────────
    { url: `${BASE}/tools/transfer-cost-calculator`, lastModified: lastMod("/tools/transfer-cost-calculator"), changeFrequency: "monthly", priority: 0.85 },

    // ── Destination hub + static landing pages ─────────────────────
    { url: `${BASE}/transfers`,               lastModified: lastMod("/transfers"), changeFrequency: "monthly", priority: 0.85 },
    // The airport-to-city-centre run: the most searched route on the site, and
    // until now the only major one without a page of its own.
    { url: `${BASE}/transfers/barcelona-city-centre`, lastModified: lastMod("/transfers/barcelona-city-centre"), changeFrequency: "monthly", priority: 0.9 },
    // Four zones that carried a published fare and had no page at all, so their
    // /pricing rows linked nowhere. La Roca and Sants have real standalone
    // demand; Begur and Vilanova are spokes off the two coast hubs.
    { url: `${BASE}/transfers/la-roca-village`, lastModified: lastMod("/transfers/la-roca-village"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/transfers/sants-station`, lastModified: lastMod("/transfers/sants-station"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/vilanova`,      lastModified: lastMod("/transfers/vilanova"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/begur`,         lastModified: lastMod("/transfers/begur"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/sitges`,        lastModified: lastMod("/transfers/sitges"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/girona`,        lastModified: lastMod("/transfers/girona"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/montserrat`,    lastModified: lastMod("/transfers/montserrat"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/lourdes`,       lastModified: lastMod("/transfers/lourdes"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/costa-brava`,   lastModified: lastMod("/transfers/costa-brava"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/lloret-de-mar`, lastModified: lastMod("/transfers/lloret-de-mar"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/cadaques`,      lastModified: lastMod("/transfers/cadaques"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/costa-dorada`,  lastModified: lastMod("/transfers/costa-dorada"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/figueres`,      lastModified: lastMod("/transfers/figueres"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/tossa-de-mar`,  lastModified: lastMod("/transfers/tossa-de-mar"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/salou`,         lastModified: lastMod("/transfers/salou"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/castelldefels`, lastModified: lastMod("/transfers/castelldefels"), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/transfers/tarragona`,     lastModified: lastMod("/transfers/tarragona"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/andorra`,       lastModified: lastMod("/transfers/andorra"), changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE}/transfers/cruise-port`,   lastModified: lastMod("/transfers/cruise-port"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/transfers/port-aventura`, lastModified: lastMod("/transfers/port-aventura"), changeFrequency: "monthly", priority: 0.75 },

    // ── Dynamic programmatic SEO pages (44 destinations) ──────────
    ...blogPages,
    ...dynamicPages,

    // ── Legal (low priority) ───────────────────────────────────────
    { url: `${BASE}/privacy`, lastModified: lastMod("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`,   lastModified: lastMod("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: lastMod("/cookies"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
