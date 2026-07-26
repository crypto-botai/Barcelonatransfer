/**
 * Shared SEO constants for all page-level metadata.
 *
 * Background: Next.js App Router completely REPLACES the root layout's
 * openGraph object when a page defines its own. That means fields like
 * type, siteName, and locale are silently lost on every page that exports
 * its own openGraph block. Spread SHARED_OG into every page's openGraph
 * to guarantee those fields are always present.
 */

export const SITE_NAME = "Élite BCN Transfers";
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
