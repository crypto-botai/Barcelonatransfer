import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FleetSection from "@/components/sections/FleetSection";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Luxury Fleet Barcelona — Mercedes V-Class & E-Class | Élite BCN" },
  description:
    "Barcelona transfer fleet: Mercedes V-Class (7-seat luxury), Mercedes E-Class & Mercedes Vito (8-seat minivan). All vehicles under 3 years old, air-conditioned, WiFi & water.",
  alternates: { canonical: "https://www.elitebcn.info/fleet" },
  openGraph: {
    title: "Luxury Fleet Barcelona — Mercedes V-Class & E-Class | Élite BCN",
    description: "Mercedes V-Class, E-Class & Vito. Premium private hire vehicles for Barcelona airport transfers and chauffeur services.",
    url: "https://www.elitebcn.info/fleet",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luxury Fleet Barcelona — Mercedes V-Class & E-Class | Élite BCN",
    description: "Mercedes V-Class, E-Class & Vito. Premium private hire vehicles for Barcelona airport transfers.",
    images: ["/opengraph-image"],
  },
};

const fleetSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Élite BCN Transfers Fleet",
  description: "Luxury private transfer fleet available in Barcelona — fixed prices, no surge pricing.",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Product",
        name: "Mercedes V-Class — Luxury 7-Seat Minivan",
        description: "7-seat luxury MPV ideal for groups and families. Perfect for airport transfers from Barcelona El Prat.",
        image: "https://www.elitebcn.info/fleet/v-class-mercedes.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: "65", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "312", bestRating: "5", worstRating: "1" },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Product",
        name: "Mercedes E-Class — Executive Saloon",
        description: "Premium executive saloon for solo and small-group airport transfers in Barcelona. Up to 3 passengers.",
        image: "https://www.elitebcn.info/fleet/e-class.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: "45", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "312", bestRating: "5", worstRating: "1" },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Product",
        name: "Mercedes Vito — Executive 8-Seat Minivan",
        description: "Executive minivan for groups up to 8 passengers. Spacious and practical for families and large groups.",
        image: "https://www.elitebcn.info/fleet/mercedes-vito.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: "60", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "312", bestRating: "5", worstRating: "1" },
      },
    },
  ],
};

export default function FleetPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fleetSchema) }} />
      <main className="pt-20">
        {/* Page header */}
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Our Fleet</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Luxury Vehicle <span className="text-gold-gradient">Fleet</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              From executive sedans to VIP minivans — every vehicle in our fleet is professionally maintained, less than 3 years old, and equipped with premium amenities.
            </p>
          </div>
        </section>

        <FleetSection />

        {/* CTA */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl text-white mb-4">Ready to Book?</h2>
            <p className="text-dark-400 mb-8">Instant online booking. Confirmed in seconds.</p>
            <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold">
              Book Your Vehicle
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
