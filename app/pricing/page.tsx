import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PricingSection from "@/components/sections/PricingSection";
import { getPublicRoutes } from "@/lib/pricing-service";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Transfer Prices — Fixed Rates | Élite BCN" },
  description: "Fixed prices for Barcelona airport, cruise port, Sitges, Andorra & more. Rates from €50 per vehicle, excl. VAT & tolls. Chauffeur & meet & greet included.",
  alternates: { canonical: "https://www.elitebcn.info/pricing" },
  keywords: ["barcelona transfer prices", "barcelona airport transfer cost", "fixed price transfer barcelona", "private transfer rates barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Transfer Prices — Fixed Rates | Élite BCN",
    description: "Fixed prices for luxury private transfers from Barcelona Airport. From €50. No hidden fees. Book online instantly.",
    url: "https://www.elitebcn.info/pricing",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona Transfer Fixed Prices" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Transfer Prices — Fixed Rates | Élite BCN",
    description: "Fixed prices for luxury private transfers from Barcelona Airport. From €50. No hidden fees. Book online instantly.",
    images: ["/opengraph-image"],
  },
};

const PRICING_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Barcelona Private Transfer Prices — Fixed Rates",
  url: "https://www.elitebcn.info/pricing",
  description: "Fixed prices per vehicle for private transfers from Barcelona Airport to all Catalonia destinations. Excludes VAT and tolls. No surge pricing.",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",    item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Pricing", item: "https://www.elitebcn.info/pricing" },
    ],
  },
  mainEntity: {
    "@type": "OfferCatalog",
    name: "Barcelona Private Transfer Fixed Prices",
    itemListElement: [
      { "@type": "Offer", name: "BCN Airport → Barcelona City Centre", price: "50",  priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
      { "@type": "Offer", name: "BCN Airport → Sitges",                price: "80",  priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
      { "@type": "Offer", name: "BCN Airport → Tarragona / PortAventura", price: "150", priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
      { "@type": "Offer", name: "BCN Airport → Lloret de Mar",         price: "100", priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
      { "@type": "Offer", name: "BCN Airport → Girona Airport",        price: "140", priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
      { "@type": "Offer", name: "BCN Airport → Andorra la Vella",      price: "300", priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
    ],
  },
};

export default async function PricingPage() {
  const routes = await getPublicRoutes();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Pricing</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Barcelona Fixed <span className="text-gold-gradient">Transfer Prices</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              All prices are fixed per vehicle and exclude VAT and tolls. 10% VAT applies only if you need an invoice; tolls are charged separately. No surge pricing, ever.
            </p>
          </div>
        </section>
        <PricingSection routes={routes} />
      </main>
      <Footer />
    </>
  );
}
