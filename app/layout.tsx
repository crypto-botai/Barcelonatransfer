import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import ExitIntentPopup from "@/components/marketing/ExitIntentPopup";
import I18nProvider from "@/components/language/I18nProvider";
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
    "Barcelona's #1 luxury private transfer. Fixed prices from €45 — no surge pricing, ever. BCN El Prat T1/T2, cruise port, hotels. Mercedes, Tesla, BMW. Book instantly 24/7.",
  keywords: [
    "Barcelona airport transfer", "transfer aeropuerto Barcelona", "BCN airport private transfer",
    "luxury transfer Barcelona", "private chauffeur Barcelona", "El Prat airport taxi Barcelona",
    "airport transfer Barcelona fixed price", "Barcelona VTC service", "VTC Barcelona aeropuerto",
    "luxury chauffeur service Barcelona", "private driver Barcelona airport", "VIP transfer Barcelona",
    "executive chauffeur Barcelona", "Mercedes V-Class Barcelona hire", "airport to Barcelona city centre",
    "Sitges transfer from airport", "Girona transfer Barcelona", "Tarragona transfer Barcelona",
    "Andorra transfer Barcelona airport", "Costa Brava transfer Barcelona",
    "cruise port Barcelona transfer", "corporate chauffeur Barcelona",
  ],
  authors: [{ name: "Élite BCN Transfers" }],
  creator: "Élite BCN Transfers",
  publisher: "Élite BCN Transfers",
  category: "travel",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.elitebcn.info",
    siteName: "Élite BCN Transfers",
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices from €45",
    description:
      "Barcelona's premier luxury chauffeur service. Fixed-price airport transfers, VIP travel, executive transport. Mercedes, Tesla, BMW. No surge pricing, ever.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    description: "Fixed-price luxury private transfers from Barcelona airport. Mercedes, Tesla, BMW. 24/7. Book instantly.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  alternates: {
    canonical: "https://www.elitebcn.info",
    languages: {
      "en": "https://www.elitebcn.info",
      "es": "https://www.elitebcn.info",
      "fr": "https://www.elitebcn.info",
      "de": "https://www.elitebcn.info",
      "it": "https://www.elitebcn.info",
      "ru": "https://www.elitebcn.info",
      "zh": "https://www.elitebcn.info",
      "ar": "https://www.elitebcn.info",
      "x-default": "https://www.elitebcn.info",
    },
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
        {/* IndexNow key for Bing/Yandex/Google auto-indexing */}
        <meta name="indexnow-key" content="a1b2c3d4e5f6789012345678elitebcn" />
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
                  email: "vtcbcn2025@gmail.com",
                  foundingDate: "2024",
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
                  description: "Luxury private airport transfers in Barcelona. Fixed prices from €45. Mercedes V-Class, E-Class, Tesla, BMW. No surge pricing. Available 24/7. BCN El Prat T1/T2, cruise port, hotels, all Costa Daurada destinations.",
                  url: "https://www.elitebcn.info",
                  telephone: "+34635383712",
                  email: "vtcbcn2025@gmail.com",
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
                    { "@type": "City", name: "Barcelona", sameAs: "https://www.wikidata.org/wiki/Q1492" },
                    { "@type": "City", name: "Sitges", sameAs: "https://www.wikidata.org/wiki/Q181033" },
                    { "@type": "City", name: "Tarragona", sameAs: "https://www.wikidata.org/wiki/Q15614" },
                    { "@type": "City", name: "Girona", sameAs: "https://www.wikidata.org/wiki/Q15627" },
                    { "@type": "City", name: "Andorra la Vella", sameAs: "https://www.wikidata.org/wiki/Q1863" },
                    { "@type": "AdministrativeArea", name: "Costa Brava" },
                    { "@type": "AdministrativeArea", name: "Costa Daurada" },
                    { "@type": "AdministrativeArea", name: "Catalonia" },
                  ],
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: "4.9",
                    reviewCount: "500",
                    bestRating: "5",
                    worstRating: "1",
                  },
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Barcelona Private Transfer Services",
                    itemListElement: [
                      { "@type": "Offer", name: "BCN Airport to Barcelona City Centre", price: "45", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "El Prat Airport to Barcelona City Transfer", description: "Fixed-price luxury private transfer from Barcelona El Prat Airport to city centre hotels. Mercedes, Tesla, BMW." } },
                      { "@type": "Offer", name: "Barcelona to Sitges Transfer", price: "65", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Sitges Private Transfer", description: "Fixed-price luxury transfer from BCN airport to Sitges. No surge pricing." } },
                      { "@type": "Offer", name: "Barcelona to Tarragona Transfer", price: "95", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Tarragona Private Transfer", description: "Fixed-price luxury transfer from BCN airport to Tarragona and PortAventura." } },
                      { "@type": "Offer", name: "Barcelona to Girona Transfer", price: "110", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Girona Private Transfer", description: "Fixed-price luxury transfer from BCN airport to Girona city or Girona Costa Brava Airport." } },
                      { "@type": "Offer", name: "Barcelona Cruise Port Transfer", price: "45", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Cruise Port Private Transfer", description: "Meet-and-greet luxury transfer to and from Barcelona World Trade Centre cruise terminal." } },
                      { "@type": "Offer", name: "Barcelona to Andorra Transfer", price: "220", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Barcelona Airport to Andorra la Vella Private Transfer", description: "Fixed-price luxury transfer from BCN airport to Andorra. 3-hour journey in premium vehicle." } },
                      { "@type": "Offer", name: "Executive Hourly Chauffeur Barcelona", price: "65", priceCurrency: "EUR", itemOffered: { "@type": "Service", name: "Hourly Chauffeur Service Barcelona", description: "By-the-hour luxury chauffeur hire in Barcelona for meetings, events, city tours." } },
                    ],
                  },
                  vehicle: [
                    { "@type": "Vehicle", name: "Mercedes V-Class", vehicleModelDate: "2022", description: "7-seat luxury MPV — ideal for groups and families" },
                    { "@type": "Vehicle", name: "Mercedes E-Class", vehicleModelDate: "2023", description: "Premium executive saloon" },
                    { "@type": "Vehicle", name: "Tesla Model S", vehicleModelDate: "2023", description: "All-electric luxury saloon — zero emissions" },
                    { "@type": "Vehicle", name: "BMW 5 Series", vehicleModelDate: "2023", description: "Business-class executive saloon" },
                  ],
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
                  acceptedAnswer: { "@type": "Answer", text: "A private transfer from Barcelona El Prat Airport (BCN) to Barcelona city centre costs from €45 with Élite BCN Transfers. This is a fixed price with no surge pricing, regardless of traffic or time of day. The price includes all tolls, meet-and-greet service, and up to 60 minutes of free waiting time." },
                },
                {
                  "@type": "Question",
                  name: "What is the best way to get from Barcelona Airport to the city?",
                  acceptedAnswer: { "@type": "Answer", text: "The best way to get from Barcelona Airport to the city centre is by private transfer. Élite BCN Transfers offers fixed-price luxury transfers from €45 in Mercedes, Tesla, and BMW vehicles. Unlike taxis, prices are fixed and confirmed at booking. Unlike the Aerobus (€6.75), you get door-to-door service with your luggage handled. The journey takes 20–40 minutes depending on traffic." },
                },
                {
                  "@type": "Question",
                  name: "Is Élite BCN Transfers a licensed VTC service?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. Élite BCN Transfers is a fully licensed VTC (Vehículo de Turismo con Conductor) operator registered with the Generalitat de Catalunya. All our drivers hold professional VTC licences and are fully insured. We comply with all Spanish transport regulations." },
                },
                {
                  "@type": "Question",
                  name: "Which destinations does Élite BCN Transfers cover?",
                  acceptedAnswer: { "@type": "Answer", text: "Élite BCN Transfers covers all of Catalonia and beyond: Barcelona city centre, Sitges (from €65), Tarragona and PortAventura (from €95), Girona and Costa Brava (from €110), Montserrat (from €85), Andorra la Vella (from €220), Barcelona Cruise Port (from €45), and all Costa Daurada resorts. We also serve long-distance routes to Madrid, Valencia, and the French border." },
                },
                {
                  "@type": "Question",
                  name: "Does Élite BCN Transfers serve Barcelona cruise port?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. Élite BCN Transfers provides meet-and-greet transfers to and from Barcelona's cruise terminals at the World Trade Centre and Moll Adossat. We monitor vessel arrival times and adjust for delays. A transfer from the cruise port to Barcelona Airport costs from €45." },
                },
                {
                  "@type": "Question",
                  name: "How far in advance do I need to book a Barcelona airport transfer?",
                  acceptedAnswer: { "@type": "Answer", text: "You can book an Élite BCN transfer instantly online up to 2 hours before your pickup time. For guaranteed availability, especially for early-morning or late-night flights, we recommend booking at least 24 hours in advance. All bookings receive instant email confirmation." },
                },
                {
                  "@type": "Question",
                  name: "What vehicles does Élite BCN Transfers use?",
                  acceptedAnswer: { "@type": "Answer", text: "Élite BCN Transfers operates a fleet of premium vehicles including: Mercedes V-Class (7 seats, ideal for groups and families), Mercedes E-Class (executive saloon), Tesla Model S (all-electric, zero-emission luxury), and BMW 5 Series (business class). All vehicles are less than 3 years old, air-conditioned, and equipped with complimentary water and WiFi." },
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
          <ExitIntentPopup />
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
