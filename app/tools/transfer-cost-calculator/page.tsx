import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CostCalculatorClient from "./CostCalculatorClient";
import { SHARED_OG } from "@/lib/seo";

const BASE = "https://www.elitebcn.info";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Airport Transfer Cost Calculator | Elite BCN" },
  description:
    "Compare Barcelona airport transfer costs: private chauffeur vs taxi vs Aerobus vs metro. Real prices by destination and group size. Instant comparison.",
  alternates: { canonical: `${BASE}/tools/transfer-cost-calculator` },
  keywords: ["barcelona airport transfer cost", "barcelona taxi vs private transfer", "aerobus vs private transfer barcelona", "barcelona transfer comparison"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Airport Transfer Cost Calculator",
    description: "Find the cheapest and best way to get from Barcelona Airport to your hotel, cruise port, or event venue. Compare private transfer, taxi, Aerobus and metro.",
    url: `${BASE}/tools/transfer-cost-calculator`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Barcelona Transfer Cost Comparison" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Airport Transfer Cost Calculator",
    description: "Compare private transfer vs taxi vs Aerobus vs metro — real Barcelona prices, instant results.",
    images: [`${BASE}/opengraph-image`],
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Barcelona Airport Transfer Cost Calculator",
  description:
    "Interactive tool to compare Barcelona airport transfer costs: private chauffeur vs metered taxi (T-1/T-2 tariffs) vs Aerobus vs metro, by destination and passenger count.",
  url: `${BASE}/tools/transfer-cost-calculator`,
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  author: { "@type": "Organization", name: "Elite BCN Transfers", url: BASE },
};

export default function TransferCostCalculatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <Navbar />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Free Tool</span>
            <h1 className="font-display text-4xl sm:text-5xl text-white mb-4">
              Barcelona Airport{" "}
              <span className="text-gold-gradient">Transfer Cost Calculator</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-xl mx-auto">
              Compare private chauffeur, metered taxi, Aerobus, and metro — with real Barcelona tariffs and your group size.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <CostCalculatorClient />

        {/* How it works */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-2xl text-white mb-8 text-center">
              How the <span className="text-gold-gradient">tariffs work</span>
            </h2>
            <div className="space-y-6 text-dark-300 text-sm leading-relaxed">
              <div>
                <h3 className="text-white font-semibold mb-1">Barcelona Taxi — T-1 (Day rate)</h3>
                <p>
                  Applies weekdays (Monday–Friday) 08:00–21:59. Flagfall €2.15 + €1.13/km.
                  All journeys from BCN Airport include a mandatory €4.50 airport supplement.
                  Minimum fare approximately €8.00.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Barcelona Taxi — T-2 (Night/Weekend rate)</h3>
                <p>
                  Applies evenings (22:00–07:59) and all day on weekends and public holidays.
                  Flagfall €2.90 + €1.30/km + €4.50 airport supplement. Long journeys (Andorra,
                  Valencia etc.) may involve additional highway tolls charged separately by the driver.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Aerobus</h3>
                <p>
                  €6.75 per person each way from either terminal (T1 or T2) to Plaça de Catalunya.
                  Journey time approximately 35 minutes. Does not serve cruise port, Sitges, Girona,
                  or any other destination — only central Barcelona.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Metro (L9 Sud)</h3>
                <p>
                  €5.15 per person using a T-Casual 10-trip card (otherwise €11.35 single airport fare).
                  Serves only central Barcelona stations. Involves luggage on escalators and up to
                  40 minutes journey time. Not available for cruise terminals, Sitges, Girona, or any
                  destination outside the metro network.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
