import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { COMPANY } from "@/lib/company-facts";
// The Google Business Profile's own name, so the LocalBusiness below can
// declare it as an alternate and Google can resolve the two to one business.
import { GOOGLE_PROFILE } from "@/data/reviews";
import AuthProvider from "@/components/layout/AuthProvider";
import I18nProvider from "@/components/language/I18nProvider";
// WhatsApp only. The support centre also offered an AI concierge; the owner
// asked for the one channel their customers actually use and that they
// answer themselves.
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import MobileBookBar from "@/components/layout/MobileBookBar";
import DeferredAnalytics from "@/components/layout/DeferredAnalytics";
import { buildOfferCatalog } from "@/lib/offer-catalog";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * The variable font, not four static cuts.
 *
 * Listing weight: ["400","500","600","700"] makes next/font fetch a separate
 * file per weight. Only some of them get a preload hint, so on production the
 * odd one out — 18.8 KB, VeryHigh priority, no preload — arrived at 1,312 ms
 * against an observed LCP of 1,335 ms. The heading painted in the fallback,
 * then Playfair swapped in and reset the LCP candidate to the moment that font
 * landed. That single late file was most of the gap between a 1.3 s paint and
 * a 3.0 s reported LCP.
 *
 * Playfair Display is a variable font covering 400-900 continuously, so
 * dropping the weight array yields one preloaded file that serves all four
 * weights the site uses — font-medium, font-semibold, font-bold and the 400
 * default on h1/h2 in globals.css. Fewer bytes, one fewer request, and the
 * swap happens before the largest paint instead of after it.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.elitebcn.info"),
  title: {
    default: "Elite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    template: "%s | Elite BCN Transfers",
  },
  description:
    "Barcelona's #1 luxury private transfer. Fixed prices from €50 — no surge pricing, ever. BCN El Prat T1/T2, cruise port, hotels. Mercedes V-Class, EQE 300 & Vito. Book 24/7.",
  authors: [{ name: "Elite BCN Transfers" }],
  creator: "Elite BCN Transfers",
  publisher: "Elite BCN Transfers",
  category: "travel",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.elitebcn.info",
    siteName: "Elite BCN Transfers",
    title: "Elite BCN | Luxury Airport Transfers Barcelona — Fixed Prices from €50",
    description:
      "Barcelona's premier luxury chauffeur service. Fixed-price airport transfers, VIP travel, executive transport. Mercedes V-Class & EQE 300 Electric. No surge pricing, ever.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    description: "Fixed-price luxury private transfers from Barcelona airport. Mercedes V-Class & EQE 300 Electric. 24/7. Book instantly.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  alternates: {
    canonical: "https://www.elitebcn.info",
    // Locale routing now exists: app/[locale] publishes /es, /fr, /de, /it,
    // /ru, /zh and /ar, and app/page.tsx emits the full hreflang set for the
    // homepage. This default only applies to pages that set no alternates of
    // their own; every page currently sets its own canonical, which replaces
    // this block entirely, so no page inherits a stray x-default.
    languages: { "x-default": "https://www.elitebcn.info" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Analytics is deferred to idle/first-interaction (see DeferredAnalytics),
            so these origins are no longer requested during the initial load.
            Lighthouse flagged all three as "Unused preconnect" — a preconnect to
            an origin the page does not request early wastes a connection slot.
            dns-prefetch is the cheap equivalent for a later, deferred request. */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* Geo meta for local SEO — the premises, not the airport.
            These named El Prat and carried its coordinates, the same false
            location the JSON-LD address had. Where the business operates is
            stated in areaServed and across the route pages; this says where it
            is. Coordinates geocoded from Carrer de Llull 465. */}
        <meta name="geo.region" content="ES-CT" />
        <meta name="geo.placename" content="Barcelona, Catalonia, Spain" />
        <meta name="geo.position" content="41.4131552;2.2178314" />
        <meta name="ICBM" content="41.4131552, 2.2178314" />
        {/* Primary @graph schema — Organization + TaxiService + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://www.elitebcn.info/#organization",
                  name: "Elite BCN Transfers",
                  url: "https://www.elitebcn.info",
                  logo: { "@type": "ImageObject", url: "https://www.elitebcn.info/icon-512.png", width: 512, height: 512 },
                  telephone: "+34635383712",
                  email: COMPANY.email,
                  foundingDate: "2018",
                  description: "Barcelona's premier luxury private transfer company. Fixed-price airport transfers, VIP travel, executive transport.",
                  // Same premises as the LocalBusiness node below. This carried
                  // postcode 08001 — central Barcelona, and not where the
                  // business is — while that node claimed 08820 at the airport.
                  // One company cannot be in two municipalities, and Google read
                  // both on every page.
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Carrer de Llull 465",
                    addressLocality: "Barcelona",
                    addressRegion: "Catalonia",
                    postalCode: "08019",
                    addressCountry: "ES",
                  },
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+34635383712",
                    contactType: "customer service",
                    // Read from the locale list. This said English, Spanish and
                    // Catalan — the site publishes eight languages and Catalan
                    // is not one of them.
                    availableLanguage: [...SUPPORTED_LOCALES],
                    hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" },
                  },
                  // Profiles that actually belong to this business. The last
                  // two entries used to be tripadvisor.com and google.com/maps
                  // — the sites' home pages, which tell Google nothing and
                  // claim a presence that was not there. The Maps link is the
                  // real listing, and it is the one that connects this domain
                  // to the reviews shown on the site.
                  sameAs: [
                    "https://www.instagram.com/elitebcn.info",
                    "https://www.facebook.com/elitebcn.info",
                    "https://www.tiktok.com/@elitebcn.info",
                    "https://www.google.com/maps?cid=8610295895899713122",
                  ],
                },
                {
                  "@type": ["TaxiService", "LocalBusiness", "LimousineBusiness"],
                  "@id": "https://www.elitebcn.info/#business",
                  name: "Elite BCN Transfers",
                  // GOOGLE_PROFILE.name is the Business Profile's exact name —
                  // "Elite Barcelona Transfer", singular. The plural below is a
                  // near-match, and a near-match does not resolve to the same
                  // entity. Derived so renaming the profile updates both at once.
                  alternateName: [
                    "Elite BCN",
                    GOOGLE_PROFILE.name,
                    "Elite Barcelona Transfers",
                    "VTC Barcelona",
                  ],
                  description: "Luxury private airport transfers in Barcelona. Fixed prices from €50. Mercedes V-Class & EQE 300 Electric. No surge pricing. Available 24/7. BCN El Prat T1/T2, cruise port, hotels, all Costa Daurada destinations.",
                  url: "https://www.elitebcn.info",
                  telephone: "+34635383712",
                  email: COMPANY.email,
                  currenciesAccepted: "EUR",
                  paymentAccepted: "Credit Card, Cash, Bank Transfer",
                  priceRange: "€€–€€€",
                  openingHours: "Mo-Su 00:00-24:00",
                  image: "https://www.elitebcn.info/opengraph-image",
                  logo: "https://www.elitebcn.info/opengraph-image",
                  // The registered premises, confirmed by the owner on 25 Aug 2026.
                  //
                  // This said streetAddress "Barcelona El Prat Airport", postcode
                  // 08820, with coordinates on the airport apron — which told
                  // Google the business is located inside El Prat, a different
                  // municipality from Barcelona. It is not: it operates from a
                  // shop in Sant Martí. A location claim that disagrees with the
                  // Google Business Profile works directly against map-pack
                  // ranking, and a fabricated one risks the profile itself.
                  //
                  // Serving the airport is stated where it belongs: areaServed
                  // below, and 37 airport routes across the site.
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Carrer de Llull 465",
                    addressLocality: "Barcelona",
                    addressRegion: "Catalonia",
                    postalCode: "08019",
                    addressCountry: "ES",
                  },
                  // Geocoded from the address above rather than typed by hand.
                  geo: { "@type": "GeoCoordinates", latitude: 41.4131552, longitude: 2.2178314 },
                  openingHoursSpecification: [
                    {
                      "@type": "OpeningHoursSpecification",
                      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
                      opens: "00:00",
                      closes: "23:59",
                    },
                  ],
                  // Eight languages are published on the site; saying so is a
                  // real differentiator for an international arrivals market.
                  knowsLanguage: [...SUPPORTED_LOCALES],
                  // Also on this node, not only on the Organization above, so the
                  // profiles and the business resolve as one entity.
                  sameAs: [
                    "https://www.instagram.com/elitebcn.info",
                    "https://www.facebook.com/elitebcn.info",
                    "https://www.tiktok.com/@elitebcn.info",
                    "https://www.google.com/maps?cid=8610295895899713122",
                  ],
                  areaServed: [
                    // Core cities
                    { "@type": "City", name: "Barcelona",       sameAs: "https://www.wikidata.org/wiki/Q1492"   },
                    { "@type": "City", name: "Girona",          sameAs: "https://www.wikidata.org/wiki/Q15627"  },
                    { "@type": "City", name: "Tarragona",       sameAs: "https://www.wikidata.org/wiki/Q15614"  },
                    { "@type": "City", name: "Andorra la Vella",sameAs: "https://www.wikidata.org/wiki/Q1863"   },
                    { "@type": "City", name: "Figueres",        sameAs: "https://www.wikidata.org/wiki/Q184419" },
                    // Costa Daurada destinations
                    { "@type": "City", name: "Sitges",          sameAs: "https://www.wikidata.org/wiki/Q181033" },
                    { "@type": "City", name: "Castelldefels",   sameAs: "https://www.wikidata.org/wiki/Q494816" },
                    { "@type": "City", name: "Cubelles",        sameAs: "https://www.wikidata.org/wiki/Q1101706"},
                    { "@type": "City", name: "Calafell",        sameAs: "https://www.wikidata.org/wiki/Q942012" },
                    { "@type": "City", name: "El Vendrell",     sameAs: "https://www.wikidata.org/wiki/Q1035285"},
                    { "@type": "City", name: "Salou",           sameAs: "https://www.wikidata.org/wiki/Q829882" },
                    { "@type": "City", name: "Cambrils",        sameAs: "https://www.wikidata.org/wiki/Q946699" },
                    { "@type": "TouristAttraction", name: "PortAventura World", sameAs: "https://www.wikidata.org/wiki/Q858059" },
                    { "@type": "City", name: "La Pineda" },
                    // Costa Brava destinations
                    { "@type": "City", name: "Mataró",          sameAs: "https://www.wikidata.org/wiki/Q215695" },
                    { "@type": "City", name: "Calella",         sameAs: "https://www.wikidata.org/wiki/Q1030827"},
                    { "@type": "City", name: "Pineda de Mar",   sameAs: "https://www.wikidata.org/wiki/Q1027249"},
                    { "@type": "City", name: "Santa Susanna",   sameAs: "https://www.wikidata.org/wiki/Q1000116"},
                    { "@type": "City", name: "Malgrat de Mar",  sameAs: "https://www.wikidata.org/wiki/Q991990" },
                    { "@type": "City", name: "Blanes",          sameAs: "https://www.wikidata.org/wiki/Q948006" },
                    { "@type": "City", name: "Lloret de Mar",   sameAs: "https://www.wikidata.org/wiki/Q962226" },
                    { "@type": "City", name: "Tossa de Mar",    sameAs: "https://www.wikidata.org/wiki/Q1002590"},
                    { "@type": "City", name: "Platja d'Aro",    sameAs: "https://www.wikidata.org/wiki/Q1019266"},
                    { "@type": "City", name: "Palamós",         sameAs: "https://www.wikidata.org/wiki/Q943888" },
                    { "@type": "City", name: "Roses",           sameAs: "https://www.wikidata.org/wiki/Q956568" },
                    { "@type": "City", name: "Empuriabrava",    sameAs: "https://www.wikidata.org/wiki/Q1337893"},
                    { "@type": "City", name: "Cadaqués",        sameAs: "https://www.wikidata.org/wiki/Q1001020"},
                    // Other destinations
                    { "@type": "TouristAttraction", name: "Montserrat" },
                    { "@type": "ShoppingCenter",    name: "La Roca Village" },
                    // Regions
                    { "@type": "AdministrativeArea", name: "Costa Brava" },
                    { "@type": "AdministrativeArea", name: "Costa Daurada" },
                    { "@type": "AdministrativeArea", name: "Catalonia" },
                  ],
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Barcelona Private Transfer Services",
                    itemListElement: buildOfferCatalog(),
                  },
                  parentOrganization: { "@id": "https://www.elitebcn.info/#organization" },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://www.elitebcn.info/#website",
                  url: "https://www.elitebcn.info",
                  name: "Elite BCN Transfers",
                  description: "Luxury private airport transfers in Barcelona — fixed prices, no surge pricing.",
                  publisher: { "@id": "https://www.elitebcn.info/#organization" },
                  inLanguage: ["en-GB", "es-ES"],
                  potentialAction: {
                    "@type": "SearchAction",
                    target: { "@type": "EntryPoint", urlTemplate: "https://www.elitebcn.info/book?q={search_term_string}" },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        {/* FAQPage schema is injected by app/faq/page.tsx only — not globally */}
      </head>
      <body className="min-h-screen bg-dark-950 antialiased">
        <AuthProvider>
          <I18nProvider>
          {children}
          <WhatsAppButton />
          <MobileBookBar />
          <DeferredAnalytics gaId="G-E9QZFG5WZY" adsId="AW-18391666445" />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
