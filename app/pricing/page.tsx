import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PricingSection from "@/components/sections/PricingSection";
import { getPublicRoutes } from "@/lib/pricing-service";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Transfer Prices — Fixed Rates | Élite BCN" },
  description: "Fixed prices for Barcelona airport, cruise port, Sitges, Andorra & more. Rates from €50 — chauffeur, tolls, meet & greet included. No surge pricing.",
  alternates: { canonical: "https://www.elitebcn.info/pricing" },
  openGraph: {
    title: "Barcelona Transfer Prices — Fixed Rates | Élite BCN",
    description: "Fixed prices for luxury private transfers from Barcelona Airport. From €50. No hidden fees. Book online instantly.",
    url: "https://www.elitebcn.info/pricing",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Transfer Prices — Fixed Rates | Élite BCN",
    description: "Fixed prices for luxury private transfers from Barcelona Airport. From €50. No hidden fees. Book online instantly.",
    images: ["/opengraph-image"],
  },
};

export default async function PricingPage() {
  const routes = await getPublicRoutes();

  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Pricing</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Fixed <span className="text-gold-gradient">Transfer Prices</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              All prices are fixed and all-inclusive. No hidden fees, no surge pricing, no surprises.
            </p>
          </div>
        </section>
        <PricingSection routes={routes} />
      </main>
      <Footer />
    </>
  );
}
