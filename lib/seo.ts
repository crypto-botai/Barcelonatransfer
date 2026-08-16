/**
 * Shared SEO constants for all page-level metadata.
 *
 * Background: Next.js App Router completely REPLACES the root layout's
 * openGraph object when a page defines its own. That means fields like
 * type, siteName, and locale are silently lost on every page that exports
 * its own openGraph block. Spread SHARED_OG into every page's openGraph
 * to guarantee those fields are always present.
 */

export const SITE_NAME = "Elite BCN Transfers";
export const BASE_URL  = "https://www.elitebcn.info";
export const OG_IMAGE  = "/opengraph-image";

export const SHARED_OG = {
  type:     "website" as const,
  siteName: SITE_NAME,
  locale:   "en_GB",
} as const;

/** Standard OG image object. Pass alt every time. */
export function ogImage(alt: string) {
  return [{ url: OG_IMAGE, width: 1200, height: 630, alt }];
}

/** BreadcrumbList JSON-LD helper */
export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type":  "ListItem",
      position: i + 1,
      name:     item.name,
      item:     item.url,
    })),
  };
}

/** Service JSON-LD helper for transfer pages */
export function serviceSchema(opts: {
  name:        string;
  description: string;
  url:         string;
  fromPrice:   number;
  areaServed?: string;
}) {
  return {
    "@context":         "https://schema.org",
    "@type":            "Service",
    name:               opts.name,
    description:        opts.description,
    url:                opts.url,
    provider: {
      "@type": "LocalBusiness",
      name:    SITE_NAME,
      url:     BASE_URL,
    },
    areaServed: opts.areaServed ?? "Barcelona, Spain",
    offers: {
      "@type":         "Offer",
      price:           String(opts.fromPrice),
      priceCurrency:   "EUR",
      availability:    "https://schema.org/InStock",
    },
  };
}

// ── Length-safe title and description builders ───────────────────────────────
//
// Google truncates a title around 60 characters and a description around 155.
// Past that it rewrites them itself, usually worse — and 53 titles and 54
// descriptions on this site were over, mostly on the two programmatic
// templates where a long hotel name pushed a fixed suffix past the limit.
//
// These pick the longest variant that still fits rather than truncating with
// an ellipsis, so every result reads as a finished phrase.

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 158;

/**
 * The first candidate that fits, else the last one trimmed at a word boundary.
 *
 * Candidates go longest (most descriptive) to shortest, so a short destination
 * name keeps the full phrasing and only a very long one falls back.
 */
export function fitTitle(candidates: string[], max = TITLE_MAX): string {
  for (const c of candidates) {
    if (c.length <= max) return c;
  }
  const last = candidates[candidates.length - 1] ?? "";
  return trimToWord(last, max);
}

/**
 * Compose a description from clauses, dropping trailing ones until it fits.
 *
 * The clauses are ordered by importance: the first is what the page is, the
 * later ones are detail worth having only if there is room.
 */
export function fitDescription(clauses: string[], max = DESCRIPTION_MAX): string {
  const parts = clauses.filter(Boolean);
  for (let n = parts.length; n > 0; n--) {
    const s = parts.slice(0, n).join(" ").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
  }
  return trimToWord(parts[0] ?? "", max);
}

/** Cuts at the last word boundary before `max`, never mid-word. */
export function trimToWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:—–-]+$/, "");
}
