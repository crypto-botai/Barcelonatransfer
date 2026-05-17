import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

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
  metadataBase: new URL("https://elitebcntransfers.com"),
  title: {
    default: "Élite BCN | Luxury Private Transfers Barcelona",
    template: "%s | Élite BCN Transfers",
  },
  description:
    "Premium luxury chauffeur service in Barcelona. Airport transfers, executive travel, VIP transportation. Mercedes S-Class, BMW 7 Series, Tesla Model S. Book online instantly.",
  keywords: [
    "luxury transfers Barcelona",
    "Barcelona airport transfer",
    "Barcelona chauffeur service",
    "private driver Barcelona",
    "VIP transfer Barcelona",
    "executive chauffeur Barcelona",
    "limousine Barcelona",
    "Mercedes chauffeur Barcelona",
    "BCN airport taxi luxury",
    "Barcelonatransfer.com",
  ],
  authors: [{ name: "Élite BCN Transfers" }],
  creator: "Élite BCN Transfers",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://elitebcntransfers.com",
    siteName: "Élite BCN Transfers",
    title: "Élite BCN | Luxury Private Transfers Barcelona",
    description:
      "Barcelona's premier luxury chauffeur service. Airport transfers, VIP travel, executive transportation.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Élite BCN Luxury Transfers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Élite BCN | Luxury Private Transfers Barcelona",
    description: "Barcelona's premier luxury chauffeur service.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "https://elitebcntransfers.com" },
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
              "@type": "LocalBusiness",
              name: "Élite BCN Transfers",
              description: "Luxury private chauffeur service in Barcelona",
              url: "https://elitebcntransfers.com",
              telephone: "+34635383712",
              email: "vtcbcn2025@gmail.com",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Barcelona",
                addressCountry: "ES",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 41.3851,
                longitude: 2.1734,
              },
              openingHours: "Mo-Su 00:00-24:00",
              priceRange: "€€€€",
              servesCuisine: "Transportation",
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-950 antialiased">
        {children}
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
      </body>
    </html>
  );
}
