import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { COMPANY } from "@/lib/company-facts";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import I18nProvider from "@/components/language/I18nProvider";
import SupportCenter from "@/components/support/SupportCenter";
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
        {/* Geo meta tags for local SEO */}
        <meta name="geo.region" content="ES-CT" />
        <meta name="geo.placename" content="Barcelona, Catalonia, Spain" />
        <meta name="geo.position" content="41.3851;2.1734" />
        <meta name="ICBM" content="41.3851, 2.1734" />
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
                  logo: { "@type": "ImageObject", url: "https://www.elitebcn.info/opengraph-image", width: 1200, height: 630 },
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
                  geo: { "@type": "GeoCoordinates", latitude: 41.3851, longitude: 2.1734 },
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
        {/* FAQPage schema — powers AI Overviews, Featured Snippets, People Also Ask */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "How much does a transfer from Barcelona Airport to city centre cost?",
                  acceptedAnswer: { "@type": "Answer", text: "A private transfer from Barcelona El Prat Airport (BCN) to Barcelona city centre costs from €50 with Élite BCN Transfers (VAT included). This is a fixed price with no surge pricing, regardless of traffic or time of day. The price includes all tolls, meet-and-greet service, and up to 60 minutes of free waiting time." },
                },
                {
                  "@type": "Question",
                  name: "What is the best way to get from Barcelona Airport to the city?",
                  acceptedAnswer: { "@type": "Answer", text: "The best way to get from Barcelona Airport to the city centre is by private transfer. Élite BCN Transfers offers fixed-price luxury transfers from €50 in Mercedes V-Class, EQE 300 Electric, Tesla Model 3, and Vito vehicles. Unlike taxis, prices are fixed and confirmed at booking. Unlike the Aerobus (€6.75), you get door-to-door service with your luggage handled. The journey takes 20–40 minutes depending on traffic." },
                },
                {
                  "@type": "Question",
                  name: "Is Élite BCN Transfers a licensed VTC service?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. Élite BCN Transfers is a fully licensed VTC (Vehículo de Turismo con Conductor) operator registered with the Generalitat de Catalunya. All our drivers hold professional VTC licences and are fully insured. We comply with all Spanish transport regulations." },
                },
                {
                  "@type": "Question",
                  name: "Which destinations does Élite BCN Transfers cover?",
                  acceptedAnswer: { "@type": "Answer", text: "Élite BCN Transfers covers all of Catalonia and beyond: Barcelona city centre, Sitges (from €80), Tarragona, Salou, La Pineda and PortAventura (from €150), Girona and Girona Airport (from €140), Montserrat (from €95), Andorra (from €300), Barcelona Cruise Port (from €50), and all Costa Daurada resorts including Castelldefels, Cubelles, Calafell, Vendrell, Cambrils. Costa Brava resorts: Lloret de Mar, Tossa de Mar, Blanes, Platja d'Aro, Palamós, Roses, Figueres, Cadaqués, Empuriabrava. We cover 62 fixed-price routes in total — no custom quotes needed." },
                },
                {
                  "@type": "Question",
                  name: "Does Élite BCN Transfers serve Barcelona cruise port?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. Élite BCN Transfers provides meet-and-greet transfers to and from Barcelona's cruise terminals at the World Trade Centre and Moll Adossat. We monitor vessel arrival times and adjust for delays. A transfer from the cruise port to Barcelona Airport costs from €50." },
                },
                {
                  "@type": "Question",
                  name: "How far in advance do I need to book a Barcelona airport transfer?",
                  acceptedAnswer: { "@type": "Answer", text: "You can book an Élite BCN transfer instantly online up to 2 hours before your pickup time. For guaranteed availability, especially for early-morning or late-night flights, we recommend booking at least 24 hours in advance. All bookings receive instant email confirmation." },
                },
                {
                  "@type": "Question",
                  name: "What vehicles does Élite BCN Transfers use?",
                  acceptedAnswer: { "@type": "Answer", text: "Élite BCN Transfers operates a fleet of 7 premium vehicles: Toyota Corolla (economy sedan), Toyota Camry (business sedan), Tesla Model 3 (electric VIP), Mercedes EQE 300 Electric (executive sedan), Mercedes Vito (executive minivan, up to 7 pax), Mercedes V-Class VIP (luxury MPV, up to 7 pax), and Mercedes Sprinter (group minibus, up to 16 pax). All vehicles are less than 3 years old, air-conditioned, and equipped with complimentary water and WiFi." },
                },
                {
                  "@type": "Question",
                  name: "How much does a transfer from Barcelona Airport to Lloret de Mar cost?",
                  acceptedAnswer: { "@type": "Answer", text: "A private transfer from Barcelona El Prat Airport to Lloret de Mar costs from €100 (economy sedan) to €220 (minibus) with Élite BCN Transfers. The price is fixed — no surge pricing, all tolls and fees included. The journey takes approximately 1 hour. Transfers from Lloret de Mar back to the airport cost the same price." },
                },
                {
                  "@type": "Question",
                  name: "How much is a transfer from Barcelona Airport to Salou or PortAventura?",
                  acceptedAnswer: { "@type": "Answer", text: "A fixed-price private transfer from Barcelona El Prat Airport to Salou, La Pineda, or PortAventura World costs from €150 (economy) to €270 (minibus) with Élite BCN Transfers. No surge pricing. All tolls, airport fees, and meet-and-greet included. The journey takes approximately 1 hour 15 minutes. The return trip (Salou/PortAventura to Barcelona Airport) costs the same." },
                },
                {
                  "@type": "Question",
                  name: "How much is a transfer from Barcelona Airport to Sitges?",
                  acceptedAnswer: { "@type": "Answer", text: "A private transfer from Barcelona El Prat Airport to Sitges costs from €80 (economy sedan) to €200 (minibus) with Élite BCN Transfers. The price is fully fixed — no hidden fees. The journey takes 30–40 minutes. The return trip from Sitges to Barcelona Airport costs the same price." },
                },
                {
                  "@type": "Question",
                  name: "Do you offer transfers from Barcelona Airport to Costa Brava resorts?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. Élite BCN Transfers offers direct fixed-price airport transfers from Barcelona El Prat Airport to all major Costa Brava resorts: Lloret de Mar (from €100), Tossa de Mar (from €110), Blanes (from €95), Platja d'Aro (from €125), Palamós (from €130), Roses and Empuriabrava (from €155), Figueres (from €155), and Cadaqués (from €165). All prices are per vehicle, VAT included, fully bidirectional." },
                },
                {
                  "@type": "Question",
                  name: "Is the transfer price the same both ways (airport to hotel and hotel to airport)?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. All Élite BCN Transfers prices are fully bidirectional — the price from Barcelona Airport to your destination is exactly the same as the return trip. For example, Barcelona Airport to PortAventura and PortAventura to Barcelona Airport are both €150 (economy). Prices never change based on direction of travel." },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-950 antialiased">
        <AuthProvider>
          <I18nProvider>
          {children}
          <SupportCenter />
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
          </I18nProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId="G-E9QZFG5WZY" />
    </html>
  );
}
