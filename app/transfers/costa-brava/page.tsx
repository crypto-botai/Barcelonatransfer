import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import { cheapestOf } from "@/lib/destination-pricing";

// The region has no single route in the table; the headline is the
// cheapest of the destinations this page actually names.
const COSTA_BRAVA_FROM = cheapestOf(["blanes", "lloret", "tossa", "sagaro", "platja_daro", "palamos", "roses", "cadaques"])!;


const COSTA_BRAVA = ROUTES.filter((r) => r.category === "costa-brava");

export const metadata: Metadata = {
  title: `Barcelona to Costa Brava Transfer — from €${COSTA_BRAVA_FROM} | Élite BCN`,
  description: `Private transfer from Barcelona to Costa Brava. Lloret, Tossa, Blanes, Roses, Palamós, Cadaqués. Fixed price from €${COSTA_BRAVA_FROM}. All vehicles. Book instantly.`,
  alternates: { canonical: "https://www.elitebcn.info/transfers/costa-brava" },
  keywords: ["barcelona costa brava transfer"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Costa Brava Transfer — from €${COSTA_BRAVA_FROM} | Fixed Price`,
    description: `Private transfer from Barcelona to Costa Brava from €${COSTA_BRAVA_FROM}. Lloret, Tossa, Blanes, Roses, Cadaqués. Fixed price, all vehicles.`,
    url: "https://www.elitebcn.info/transfers/costa-brava",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona to Costa Brava Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Costa Brava Transfer — from €${COSTA_BRAVA_FROM} | Élite BCN`,
    description: `Private transfer from Barcelona to Costa Brava from €${COSTA_BRAVA_FROM}. Lloret, Tossa, Blanes, Roses. Fixed price.`,
    images: ["/opengraph-image"],
  },
};

const costaBravaSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Costa Brava Private Transfer",
  description: "Luxury fixed-price private transfers from Barcelona to all Costa Brava resorts — Lloret de Mar, Tossa de Mar, Cadaqués, Roses and beyond.",
  url: "https://www.elitebcn.info/transfers/costa-brava",
  provider: { "@type": "LocalBusiness", name: "Élite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Costa Brava, Catalonia, Spain",
  offers: { "@type": "Offer", price: String(COSTA_BRAVA_FROM), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const costaBravaBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",         item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Costa Brava",  item: "https://www.elitebcn.info/transfers/costa-brava" },
  ],
};

export default function CostaBravaTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(costaBravaSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(costaBravaBreadcrumb) }} />
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-600 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Costa Brava</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Costa Brava
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Costa Brava Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfers from Barcelona to the entire Costa Brava coastline.
              Lloret de Mar, Tossa de Mar, Cadaqués, Roses and beyond — fixed prices per vehicle, excl. VAT and tolls, all vehicle classes.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 1–3 hrs</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 60–200 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{COSTA_BRAVA_FROM} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Costa Brava Transfer
            </Link>
          </div>
        </section>

        {/* Full price table */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Costa Brava <span className="text-gold-gradient">Transfer Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Destination</th>
                    <th className="text-center text-dark-400 font-medium p-3">Sedan<br /><span className="text-dark-600 font-normal text-xs">1–3 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Business<br /><span className="text-dark-600 font-normal text-xs">1–3 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Minivan<br /><span className="text-dark-600 font-normal text-xs">4–8 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3 text-gold-400">V-Class<br /><span className="text-dark-600 font-normal text-xs">7 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Minibus<br /><span className="text-dark-600 font-normal text-xs">9+ pax</span></th>
                  </tr>
                </thead>
                <tbody>
                  {COSTA_BRAVA.map((r) => (
                    <tr key={r.to} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-white font-medium">{r.label.replace("Barcelona ⇄ ", "")}</td>
                      <td className="p-3 text-center text-white">€{r.economy}</td>
                      <td className="p-3 text-center text-white">€{r.business}</td>
                      <td className="p-3 text-center text-white">€{r.minivan}</td>
                      <td className="p-3 text-center text-gold-400 font-semibold">€{r.vclass}</td>
                      <td className="p-3 text-center text-white">€{r.minibus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">
              Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Includes meet &amp; greet and 60 min free waiting. Child seats free.
            </p>
          </div>
        </section>

        {/* About */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About the <span className="text-gold-gradient">Costa Brava</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                The Costa Brava ("Wild Coast") stretches 214 km from Blanes north to the French border —
                a dramatic landscape of rugged cliffs, hidden coves, pine forests, and charming fishing villages.
              </p>
              <p>
                Key highlights include <strong className="text-white">Tossa de Mar</strong> (medieval walled town),
                <strong className="text-white"> Cadaqués</strong> (Salvador Dalí&apos;s home and Cap de Creus National Park),
                <strong className="text-white"> Lloret de Mar</strong> (beaches and nightlife), and
                the <strong className="text-white">Dalí Theatre-Museum</strong> in Figueres.
              </p>
              <p>
                There is no practical direct public transport from Barcelona to most Costa Brava destinations.
                A private transfer is the fastest, most comfortable option.
              </p>
            </div>
          </div>
        </section>

        {/* Why us */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Costa Brava transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed transparent prices", body: "Fixed price per vehicle, excluding VAT and tolls. Fuel and driver included; 10% VAT applies only if you need an invoice." },
                { icon: Clock, title: "Direct door-to-door", body: "Straight to your villa, hotel, or port — no bus stops, no changes, no shared rides." },
                { icon: Star, title: "All vehicle classes", body: "Sedan, Business, Minivan (Vito), V-Class VIP, or Minibus — choose what fits your group." },
                { icon: CheckCircle2, title: "Child seats available", body: "Baby seats and boosters free on request. Perfect for family holidays." },
                { icon: MapPin, title: "Return transfers", body: "Book outbound and return together. We arrive at your villa exactly when you need." },
                { icon: Shield, title: "24/7 availability", body: "Early morning flights, late-night arrivals — we operate every hour of every day." },
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

        {/* CTA */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Costa Brava transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{COSTA_BRAVA_FROM}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
