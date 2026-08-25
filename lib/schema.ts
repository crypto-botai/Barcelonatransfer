// Typed JSON-LD schema builders — single place to produce structured data.
// All builders return plain objects ready for JSON.stringify().
// Import here; never hand-write JSON-LD in page files.

import { COMPANY } from "@/lib/company-facts";

const SITE = "https://www.elitebcn.info";

// ── Base organisation reference ─────────────────────────────────────────────
/**
 * A reference to the one business entity, for use as `provider` on Service and
 * Product nodes.
 *
 * This used to redeclare the business under its own "@id" of "/#org", giving
 * the company a third identity alongside "/#organization" and "/#business" in
 * the root layout. To a machine those are three separate entities, so the
 * address attached to one, the reviews to another and the social profiles to a
 * third — which is the opposite of the entity consolidation that helps a local
 * business rank. A bare @id reference resolves against the full node the root
 * layout renders on every page.
 *
 * It also carried an aggregateRating built from the real Google figures, and it
 * was live on /book. The numbers were true, but reviews about a business,
 * published on that business's own site, are self-serving under Google's
 * structured data policy: ineligible for rich results, and a manual-action risk
 * for no gain. The reviews stay on the page for people to read, where they do
 * their actual job.
 */
export function organisationRef() {
  return { "@id": `${SITE}/#business` } as const;
}

// ── BreadcrumbList ──────────────────────────────────────────────────────────
export interface BreadcrumbItem {
  name: string;
  item: string;
}

export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map((b, i) => ({
      "@type":   "ListItem",
      position:  i + 1,
      name:      b.name,
      item:      b.item,
    })),
  } as const;
}

// ── Product (fleet vehicle) ─────────────────────────────────────────────────
export function vehicleProduct(opts: {
  name: string;
  description: string;
  image: string;
  url: string;
  priceFrom: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type":    "Product",
    name:       opts.name,
    description: opts.description,
    image:      opts.image.startsWith("http") ? opts.image : `${SITE}${opts.image}`,
    url:        opts.url.startsWith("http") ? opts.url : `${SITE}${opts.url}`,
    brand:      { "@type": "Brand", name: "Elite BCN" },
    offers: {
      "@type":        "Offer",
      priceCurrency:  "EUR",
      price:          opts.priceFrom,
      priceValidUntil: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split("T")[0],
      availability:   "https://schema.org/InStock",
      url:            `${SITE}/book`,
    },
    provider: organisationRef(),
  } as const;
}

// ── Service (route/destination) ─────────────────────────────────────────────
export function transferService(opts: {
  name: string;
  description: string;
  url: string;
  priceFrom: number;
  fromCity: string;
  toCity: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type":    "Service",
    name:       opts.name,
    description: opts.description,
    url:        opts.url.startsWith("http") ? opts.url : `${SITE}${opts.url}`,
    provider:   organisationRef(),
    areaServed: [
      { "@type": "City", name: opts.fromCity },
      { "@type": "City", name: opts.toCity },
    ],
    offers: {
      "@type":       "Offer",
      price:         opts.priceFrom,
      priceCurrency: "EUR",
      priceSpecification: {
        "@type":       "UnitPriceSpecification",
        price:         opts.priceFrom,
        priceCurrency: "EUR",
        unitText:      "per vehicle",
      },
    },
  } as const;
}

// ── FAQPage ─────────────────────────────────────────────────────────────────
export function faqPage(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: items.map((item) => ({
      "@type":        "Question",
      name:           item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  } as const;
}

// ── WebPage ─────────────────────────────────────────────────────────────────
export function webPage(opts: {
  name: string;
  description: string;
  url: string;
  breadcrumb?: BreadcrumbItem[];
}) {
  return {
    "@context":   "https://schema.org",
    "@type":      "WebPage",
    name:         opts.name,
    description:  opts.description,
    url:          opts.url.startsWith("http") ? opts.url : `${SITE}${opts.url}`,
    isPartOf:     { "@type": "WebSite", url: SITE, name: COMPANY.legalName },
    ...(opts.breadcrumb ? { breadcrumb: breadcrumbList(opts.breadcrumb) } : {}),
  } as const;
}
