import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import ExitIntentPopup from "@/components/marketing/ExitIntentPopup";

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
  metadataBase: new URL("https://elitebcn.info"),
  title: {
    default: "Élite BCN | Luxury Airport Transfers Barcelona",
    template: "%s | Élite BCN Transfers",
  },
  description:
    "Luxury private airport transfers in Barcelona. Fixed prices — no surprises. BCN El Prat airport, cruise terminal, hotels. Mercedes V-Class, E-Class, Tesla. Book instantly online.",
  keywords: [
    "Barcelona airport transfer",
    "BCN airport taxi",
    "luxury transfer Barcelona",
    "private chauffeur Barcelona",
    "El Prat airport taxi Barcelona",
    "airport transfer Barcelona fixed price",
    "Barcelona VTC service",
    "luxury chauffeur service Barcelona",
    "private driver Barcelona airport",
    "VIP transfer Barcelona",
    "Mercedes V-Class Barcelona",
    "airport to Barcelona city",
    "Sitges transfer",
    "Tarragona transfer",
    "Andorra transfer from Barcelona",
  ],
  authors: [{ name: "Élite BCN Transfers" }],
  creator: "Élite BCN Transfers",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://elitebcn.info",
    siteName: "Élite BCN Transfers",
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices",
    description:
      "Barcelona's premier luxury chauffeur service. Fixed-price airport transfers, VIP travel, executive transportation. Book online instantly.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Élite BCN Luxury Airport Transfers Barcelona",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Élite BCN | Luxury Airport Transfers Barcelona",
    description: "Fixed-price luxury transfers from Barcelona airport. Mercedes V-Class, E-Class, Tesla. Book instantly.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "https://elitebcn.info" },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["TaxiService", "LocalBusiness"],
              name: "Élite BCN Transfers",
              description: "Luxury private airport transfers in Barcelona with fixed prices. Mercedes V-Class, E-Class, Tesla. Available 24/7.",
              url: "https://elitebcn.info",
              telephone: "+34635383712",
              email: "vtcbcn2025@gmail.com",
              currenciesAccepted: "EUR",
              paymentAccepted: "Credit Card, Cash",
              priceRange: "€€€",
              openingHours: "Mo-Su 00:00-24:00",
              areaServed: {
                "@type": "GeoCircle",
                geoMidpoint: { "@type": "GeoCoordinates", latitude: 41.3851, longitude: 2.1734 },
                geoRadius: "150000",
              },
              address: {
                "@type": "PostalAddress",
                addressLocality: "Barcelona",
                addressRegion: "Catalonia",
                addressCountry: "ES",
              },
              geo: { "@type": "GeoCoordinates", latitude: 41.3851, longitude: 2.1734 },
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Airport Transfer Services",
                itemListElement: [
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "El Prat Airport to Barcelona City", description: "Fixed price luxury transfer" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Barcelona to Sitges Transfer", description: "Fixed price luxury transfer" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Barcelona to Tarragona Transfer", description: "Fixed price luxury transfer" } },
                ],
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-950 antialiased">
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
