import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";

// Read from the price table, never restated. A repriced route reaches
// this page, its schema and the checkout together, or reaches none.
const LADDER = ladderFor("sitges", "airport")!;


export const metadata: Metadata = {
  title: `Barcelona to Sitges Transfer — from €${LADDER.economy} | Fixed Price`,
  description:
    `Private transfer from Barcelona to Sitges. Fixed price from €${LADDER.economy}. 35-minute journey. Meet & greet in arrivals, no surge pricing. Book instantly.`,
  alternates: { canonical: "https://www.elitebcn.info/transfers/sitges" },
  keywords: ["barcelona sitges transfer", "sitges private car barcelona", "sitges airport transfer", "barcelona sitges taxi"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Sitges Transfer — from €${LADDER.economy} | Fixed Price`,
    description: `Private transfer from Barcelona to Sitges from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing. 35 minutes.`,
    url: "https://www.elitebcn.info/transfers/sitges",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to Sitges Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Sitges Transfer — from €${LADDER.economy} | Fixed Price`,
    description: `Private transfer from Barcelona to Sitges from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing. 35 minutes.`,
    images: ["/opengraph-image"],
  },
};

const sitgesServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Sitges Private Transfer",
  description: `Fixed-price private transfer from Barcelona Airport or City to Sitges. From €${LADDER.economy}. 35-minute journey, meet & greet, no surge pricing.`,
  url: "https://www.elitebcn.info/transfers/sitges",
  provider: { "@type": "LocalBusiness", name: "Elite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Sitges, Garraf, Catalonia, Spain",
  offers: { "@type": "Offer", price: String(LADDER.economy), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",          item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Transfers",     item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Sitges",        item: "https://www.elitebcn.info/transfers/sitges" },
  ],
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport to Sitges Private Transfer",
  description: "Luxury fixed-price private transfer from Barcelona El Prat Airport to Sitges. Flight tracking and 60 min free wait at the airport; meet & greet €5.",
  provider: {
    "@type": "LocalBusiness",
    name: "Elite BCN Transfers",
    url: "https://www.elitebcn.info",
    telephone: "+34635383712",
  },
  areaServed: [
    { "@type": "City", name: "Barcelona" },
    { "@type": "City", name: "Sitges" },
  ],
  offers: {
    "@type": "Offer",
    price: String(LADDER.economy),
    priceCurrency: "EUR",
    priceSpecification: { "@type": "UnitPriceSpecification", price: String(LADDER.economy), priceCurrency: "EUR", unitText: "per vehicle" },
  },
};

export default function SitgesTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sitgesServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">
                All Destinations
              </Link>
              <ChevronRight size={14} className="text-dark-600 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Sitges</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona ⇄ Sitges
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Sitges Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer between Barcelona city and Sitges. Fixed price, no surge pricing.
              Airport pickups are a fixed €{LADDER.economy} — book instantly online.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 35 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 35 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{LADDER.economy} fixed</div>
            </div>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Sitges Transfer — €{LADDER.economy}
            </Link>
          </div>
        </section>

        {/* Why book */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">Sitges transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${LADDER.economy}`, body: "The price you see is the price you pay. No meter, no traffic surcharges, no hidden fees." },
                { icon: Clock, title: "60 minutes free waiting", body: "Airport pickups include 60 free minutes from landing. Meet & greet inside arrivals with a name board is an optional €5 add-on." },
                { icon: Star, title: "Real-time flight tracking", body: "We monitor your flight live. If it's delayed, your driver adjusts automatically — no extra charge." },
                { icon: CheckCircle2, title: "Premium vehicles", body: "Mercedes V-Class (7 pax), EQE 300 Electric & Vito (8 pax). Air-conditioned, bottled water, WiFi on request." },
                { icon: MapPin, title: "Door-to-door service", body: "Dropped directly at your Sitges hotel, villa, or address. No sharing, no stops, no detours." },
                { icon: Shield, title: "Licensed VTC operator", body: "Fully licensed VTC (Vehículo de Turismo con Conductor) under Generalitat de Catalunya regulations." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <Icon size={24} className="text-gold-500 mb-3" />
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Sitges */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Sitges</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Sitges is one of Catalonia's most celebrated destinations — a glamorous coastal town 35 km southwest of Barcelona on the Garraf coast.
                Famous for its beautiful beaches, vibrant nightlife, and welcoming atmosphere, Sitges draws visitors year-round.
              </p>
              <p>
                The town is world-renowned for the <strong className="text-white">Sitges Carnival</strong> (one of Europe's most spectacular),
                the <strong className="text-white">Sitges International Film Festival</strong> each October,
                and a thriving LGBTQ+ scene that has earned it the nickname "the San Francisco of Spain."
              </p>
              <p>
                A private transfer from Barcelona Airport takes approximately 35 minutes — a much more comfortable option than navigating
                the train and bus connections that take 1.5 hours with luggage.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {["Sitges Beach", "Sitges Carnival", "Old Town", "Film Festival"].map((item) => (
                <div key={item} className="bg-dark-900 border border-white/[0.08] rounded-lg p-3 text-center">
                  <span className="text-dark-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing table */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Sitges Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4">Passengers</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { vehicle: "Economy sedan",            pax: "1–3", price: `€${LADDER.economy}` },
                    { vehicle: "Business sedan",           pax: "1–3", price: `€${LADDER.business}` },
                    { vehicle: "Minivan (4–8 pax)",        pax: "1–8", price: `€${LADDER.minivan}` },
                    { vehicle: "V-Class (7 pax)",          pax: "1–7", price: `€${LADDER.vclass}` },
                    { vehicle: "Minibus (9+ pax)",         pax: "9–16", price: `€${LADDER.minibus}` },
                  ].map((row) => (
                    <tr key={row.vehicle} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.vehicle}</td>
                      <td className="p-4 text-dark-400">{row.pax} pax</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet & greet, child seats and other extras are optional and charged separately.</p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Sitges transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Now — from €{LADDER.economy}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
