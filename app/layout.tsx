import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { COMPANY } from "@/lib/company-facts";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import I18nProvider from "@/components/language/I18nProvider";
import SupportCenter from "@/components/support/SupportCenter";
import MobileBookBar from "@/components/layout/MobileBookBar";
import { GoogleAnalytics } from "@next/third-parties/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.elitebcn.info"),
  title: {
    default: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    template: "%s | Élite BCN Transfers",
  },
  description:
    "Barcelona's #1 luxury private transfer. Fixed prices from €50 — no surge pricing, ever. BCN El Prat T1/T2, cruise port, hotels. Mercedes V-Class, EQE 300 & Vito. Book 24/7.",
  authors: [{ name: "Élite BCN Transfers" }],
  creator: "Élite BCN Transfers",
  publisher: "Élite BCN Transfers",
  category: "travel",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.elitebcn.info",
    siteName: "Élite BCN Transfers",
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices from €50",
    description:
      "Barcelona's premier luxury chauffeur service. Fixed-price airport transfers, VIP travel, executive transport. Mercedes V-Class & EQE 300 Electric. No surge pricing, ever.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    description: "Fixed-price luxury private transfers from Barcelona airport. Mercedes V-Class & EQE 300 Electric. 24/7. Book instantly.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  alternates: {
    canonical: "https://www.elitebcn.info",
    // No URL-based locale routing exists — all locales share the same URL.
    // x-default tells Google this URL is the canonical for all languages.
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
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        {/* Geo meta tags for local SEO — BCN El Prat Airport is primary service location */}
        <meta name="geo.region" content="ES-CT" />
        <meta name="geo.placename" content="Barcelona El Prat Airport, Catalonia, Spain" />
        <meta name="geo.position" content="41.2974;2.0833" />
        <meta name="ICBM" content="41.2974, 2.0833" />
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
                  name: "Élite BCN Transfers",
                  url: "https://www.elitebcn.info",
                  logo: { "@type": "ImageObject", url: "https://www.elitebcn.info/icon-512.png", width: 512, height: 512 },
                  telephone: "+34635383712",
                  email: COMPANY.email,
                  foundingDate: "2018",
                  description: "Barcelona's premier luxury private transfer company. Fixed-price airport transfers, VIP travel, executive transport.",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Barcelona",
                    addressRegion: "Catalonia",
                    postalCode: "08001",
                    addressCountry: "ES",
                  },
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+34635383712",
                    contactType: "customer service",
                    availableLanguage: ["English", "Spanish", "Catalan"],
                    hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" },
                  },
                  sameAs: [
                    "https://www.instagram.com/elitebcntransfers",
                    "https://www.facebook.com/elitebcntransfers",
                    "https://www.tripadvisor.com/",
                    "https://www.google.com/maps/",
                  ],
                },
                {
                  "@type": ["TaxiService", "LocalBusiness", "LimousineBusiness"],
                  "@id": "https://www.elitebcn.info/#business",
                  name: "Élite BCN Transfers",
                  alternateName: ["Elite BCN", "Élite BCN", "Elite Barcelona Transfers", "VTC Barcelona"],
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
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Barcelona El Prat Airport",
                    addressLocality: "Barcelona",
                    addressRegion: "Catalonia",
                    postalCode: "08820",
                    addressCountry: "ES",
                  },
                  geo: { "@type": "GeoCoordinates", latitude: 41.2974, longitude: 2.0833 },
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
                    itemListElement: [
                      // Airport ⇄ Barcelona
                      { "@type": "Offer", name: "BCN Airport to Barcelona City Centre", price: "50", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "El Prat Airport to Barcelona City Transfer", description: "Fixed-price luxury private transfer from Barcelona El Prat Airport (T1/T2) to city centre hotels. From €50 economy to €75 V-Class." } },
                      // Airport ⇄ Cruise Port
                      { "@type": "Offer", name: "BCN Airport to Cruise Port Transfer", price: "50", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Cruise Port Private Transfer", description: "Fixed-price transfer from El Prat Airport to Barcelona World Trade Centre or Moll Adossat cruise terminals." } },
                      // Airport ⇄ Andorra
                      { "@type": "Offer", name: "BCN Airport to Andorra Transfer", price: "300", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Andorra la Vella Private Transfer", description: "Fixed-price luxury transfer from BCN Airport to Andorra la Vella. From €300 economy to €630 minibus." } },
                      // Airport ⇄ Girona Airport
                      { "@type": "Offer", name: "BCN Airport to Girona Airport Transfer", price: "140", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona El Prat Airport to Girona Costa Brava Airport Transfer", description: "Inter-airport private transfer between BCN (El Prat) and GRO (Girona). From €140 economy." } },
                      // Airport ⇄ Costa Daurada
                      { "@type": "Offer", name: "BCN Airport to Sitges Transfer", price: "80", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Sitges Private Transfer", description: "Fixed-price private transfer from Barcelona El Prat Airport to Sitges. From €80 economy." } },
                      { "@type": "Offer", name: "BCN Airport to Tarragona / PortAventura", price: "150", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Tarragona and PortAventura Transfer", description: "Fixed-price transfer from BCN Airport to Tarragona, Salou, La Pineda, and PortAventura World. From €150." } },
                      { "@type": "Offer", name: "BCN Airport to Salou Transfer", price: "150", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Salou Private Transfer", description: "Direct fixed-price transfer from BCN Airport to Salou resort. From €150 economy." } },
                      { "@type": "Offer", name: "BCN Airport to Cambrils Transfer", price: "160", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Cambrils Private Transfer", description: "Direct fixed-price transfer from BCN Airport to Cambrils. From €160 economy." } },
                      // Airport ⇄ Costa Brava
                      { "@type": "Offer", name: "BCN Airport to Lloret de Mar Transfer", price: "100", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Lloret de Mar Private Transfer", description: "Fixed-price transfer from BCN El Prat Airport to Lloret de Mar, Costa Brava. From €100 economy." } },
                      { "@type": "Offer", name: "BCN Airport to Tossa de Mar Transfer", price: "110", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Tossa de Mar Private Transfer", description: "Fixed-price transfer from BCN Airport to Tossa de Mar, Costa Brava. From €110 economy." } },
                      { "@type": "Offer", name: "BCN Airport to Roses / Empuriabrava", price: "155", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Roses and Empuriabrava Transfer", description: "Fixed-price transfer from BCN Airport to Roses and Empuriabrava, northern Costa Brava. From €155 economy." } },
                      // City routes
                      { "@type": "Offer", name: "Barcelona to Sitges Transfer", price: "75", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona City to Sitges Private Transfer", description: "Fixed-price luxury transfer from Barcelona city centre to Sitges. No surge pricing." } },
                      { "@type": "Offer", name: "Barcelona to Tarragona Transfer", price: "145", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona City to Tarragona Private Transfer", description: "Fixed-price luxury transfer from Barcelona to Tarragona and PortAventura." } },
                      // Hourly
                      { "@type": "Offer", name: "Executive Hourly Chauffeur Barcelona", price: "50", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Hourly Chauffeur Service Barcelona", description: "By-the-hour luxury chauffeur hire in Barcelona. From €45/h economy, €50/h business, €65/h luxury. Minimum 4 hours." } },
                    ],
                  },
                  parentOrganization: { "@id": "https://www.elitebcn.info/#organization" },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://www.elitebcn.info/#website",
                  url: "https://www.elitebcn.info",
                  name: "Élite BCN Transfers",
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
          <SupportCenter />
          <MobileBookBar />
<Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: "8px",
              },
            }}
          />
          <GoogleAnalytics gaId="G-E9QZFG5WZY" />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
