// Typed JSON-LD schema builders — single place to produce structured data.
// All builders return plain objects ready for JSON.stringify().
// Import here; never hand-write JSON-LD in page files.

import { COMPANY, SOCIAL_PROOF, totalReviews } from "@/lib/company-facts";

const SITE = "https://www.elitebcn.info";

// ── Base organisation reference ─────────────────────────────────────────────
export function organisationRef() {
  return {
    "@type": "LocalBusiness",
    "@id":   `${SITE}/#org`,
    name:    COMPANY.legalName,
    url:     SITE,
    telephone: COMPANY.phone,
    email:   COMPANY.email,
    address: {
      "@type":           "PostalAddress",
      addressLocality:   COMPANY.city,
      addressRegion:     COMPANY.region,
      addressCountry:    COMPANY.country,
    },
    aggregateRating: {
      "@type":       "AggregateRating",
      ratingValue:   SOCIAL_PROOF.google.rating,
      reviewCount:   totalReviews(),
      bestRating:    5,
      worstRating:   1,
    },
  } as const;
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
    brand:      { "@type": "Brand", name: "Élite BCN" },
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
