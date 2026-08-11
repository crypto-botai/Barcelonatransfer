import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";

// Read from the price table, never restated. A repriced route reaches
// this page, its schema and the checkout together, or reaches none.
const LADDER = ladderFor("cadaques", "airport")!;


const BASE = "https://www.elitebcn.info";

export const metadata: Metadata = {
  title: `Barcelona to Cadaqués Transfer — from €${LADDER.economy} | Élite BCN`,
  description:
    `Private transfer from Barcelona to Cadaqués. Fixed price from €${LADDER.economy}. 2h 15min journey via AP-7. Meet & greet, no surge pricing. Book instantly.`,
  alternates: { canonical: `${BASE}/transfers/cadaques` },
  keywords: ["barcelona cadaques transfer", "cadaques private car barcelona", "cadaques airport transfer", "costa brava transfer cadaques"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Cadaqués Transfer — from €${LADDER.economy} | Fixed Price`,
    description: `Private transfer from Barcelona to Cadaqués from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing. 2h 15min.`,
    url: `${BASE}/transfers/cadaques`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona to Cadaqués Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Cadaqués Transfer — from €${LADDER.economy} | Élite BCN`,
    description: `Private transfer from Barcelona to Cadaqués from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing.`,
    images: ["/opengraph-image"],
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",      item: BASE },
    { "@type": "ListItem", position: 2, name: "Transfers", item: `${BASE}/transfers` },
    { "@type": "ListItem", position: 3, name: "Cadaqués",  item: `${BASE}/transfers/cadaques` },
  ],
};

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Cadaqués Private Transfer",
  description: `Luxury fixed-price private transfer from Barcelona (city or El Prat Airport) to Cadaqués, Costa Brava. From €${LADDER.economy}. Meet & greet, flight tracking, 60 min free wait.`,
  url: `${BASE}/transfers/cadaques`,
  provider: { "@type": "LocalBusiness", name: "Élite BCN Transfers", url: BASE, telephone: "+34635383712" },
  areaServed: [
    { "@type": "City", name: "Barcelona" },
    { "@type": "City", name: "Cadaqués" },
  ],
  offers: { "@type": "Offer", price: String(LADDER.economy), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const FAQS = [
  {
    q: "How long is the transfer from Barcelona to Cadaqués?",
    a: "The private transfer from Barcelona to Cadaqués covers approximately 170 km via the AP-7 motorway towards Figueres, then the winding coastal road over the Cap de Creus foothills. Journey time is approximately 2 hours 15 minutes under normal traffic conditions — the final stretch is narrow and mountainous, so allow a little extra time in peak summer traffic.",
  },
  {
    q: "How much does a private transfer from Barcelona to Cadaqués cost?",
    a: `A fixed-price private transfer from Barcelona to Cadaqués starts from €${LADDER.economy} for an Economy sedan (Toyota Corolla, 1–3 passengers). A Business sedan (EQE 300 Electric or Tesla Model 3) is €260, and a Mercedes V-Class for groups up to 7 is €310. Prices exclude VAT and tolls: 10% VAT is added only if you request an invoice, and motorway tolls are charged separately. Meet & greet and 60 minutes of free waiting are included, with no surcharge for the longer mountain approach.`,
  },
  {
    q: "Can Élite BCN transfer us onward from Cadaqués to Girona Airport or back to Barcelona?",
    a: "Yes. Every route is bidirectional at the same fixed price, and we can also arrange a one-way transfer from Cadaqués directly to Girona-Costa Brava Airport (GRO) instead of returning to Barcelona — useful if you're flying out from Girona rather than BCN. Contact us to confirm pricing for that specific combination.",
  },
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const NEARBY = [
  { name: "Lloret de Mar", href: "/transfers/lloret-de-mar", blurb: "Costa Brava's best-known resort town, further south" },
  { name: "Costa Brava",   href: "/transfers/costa-brava",   blurb: "Tossa de Mar, Blanes, Roses and the rest of the coast" },
  { name: "Girona",        href: "/transfers/girona",        blurb: "Medieval city and Girona-Costa Brava Airport (GRO)" },
];

export default function CadaquesTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <Navbar />
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
              <span className="text-gold-400 text-sm">Cadaqués</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona ⇄ Cadaqués
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Cadaqués Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer between Barcelona (city or BCN Airport) and Cadaqués. Fixed price, no surge pricing, ever.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 2h 15min</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 170 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{LADDER.economy} fixed</div>
            </div>
            <Link
              href="/book?destination=Cadaques"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Cadaqués Transfer — €{LADDER.economy}
            </Link>
          </div>
        </section>

        {/* Why book */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Cadaqués transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${LADDER.economy}`, body: "The price you see is the price you pay — including the winding final approach over Cap de Creus. No meter, no surcharges." },
                { icon: Clock, title: "Meet & greet included", body: "Your driver waits in the arrivals hall or your Barcelona address with your name on a board. 60 minutes free waiting from your flight landing." },
                { icon: Star, title: "Real-time flight tracking", body: "We monitor your flight live. If it's delayed, your driver adjusts automatically — no extra charge." },
                { icon: CheckCircle2, title: "Premium vehicles", body: "Mercedes V-Class (7 pax), EQE 300 Electric & Vito (8 pax). Air-conditioned, bottled water, WiFi on request." },
                { icon: MapPin, title: "Door-to-door service", body: "Dropped directly at your Cadaqués hotel, villa, or address — no need to navigate the village's narrow one-way streets yourself." },
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

        {/* About Cadaqués */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Cadaqués</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Cadaqués is widely considered the most beautiful village on the Costa Brava — a whitewashed fishing town
                wrapped around a small bay on the Cap de Creus peninsula, roughly 170 km north-east of Barcelona. Its
                isolation, reached only by a single winding mountain road, has kept it free of the mass development seen
                elsewhere on the coast.
              </p>
              <p>
                The town is inseparable from <strong className="text-white">Salvador Dalí</strong>, who lived for decades in
                neighbouring Portlligat; the Dalí Museum-House there remains one of the region's most visited sites. Cobblestone
                streets, cobalt-blue water, and the surrounding <strong className="text-white">Cap de Creus Natural Park</strong> —
                Spain's first maritime-terrestrial protected area — have long drawn artists and travellers seeking a quieter
                alternative to the busier southern Costa Brava resorts.
              </p>
              <p>
                A private transfer from Barcelona takes approximately 2 hours 15 minutes, most of it on the AP-7 motorway
                towards Figueres, with a final 30-minute stretch over a narrow, winding pass. Public transport to Cadaqués
                is limited to a single daily coach connection via Figueres, making a direct private transfer by far the most
                practical option for visitors with luggage or a fixed schedule.
              </p>
              <p>
                Because the approach road is narrow and can be slow during July and August, we recommend booking your transfer
                with a little flexibility either side of your planned arrival or departure time, particularly around sunset
                when day-trippers head back toward Roses and Figueres.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {["Dalí Museum-House", "Cap de Creus Park", "Old Town", "Portlligat Bay"].map((item) => (
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
              Cadaqués Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4">Passengers</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { vehicle: "Economy sedan (Corolla)",              pax: "1–3", price: `€${LADDER.economy}` },
                    { vehicle: "Business sedan (EQE 300 / Tesla M3)",   pax: "1–3", price: `€${LADDER.business}` },
                    { vehicle: "Minivan (Vito, 4–8 pax)",               pax: "1–8", price: `€${LADDER.minivan}` },
                    { vehicle: "V-Class (7 pax)",                      pax: "1–7", price: `€${LADDER.vclass}` },
                    { vehicle: "Minibus (Sprinter, 9+ pax)",            pax: "9–16", price: `€${LADDER.minibus}` },
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
            <p className="text-dark-500 text-xs text-center mt-4">Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Includes meet & greet and 60 min free waiting.</p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Cadaqués Transfer <span className="text-gold-gradient">FAQs</span>
            </h2>
            <div className="space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.q} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-3 text-base">{faq.q}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nearby destinations */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-2xl text-white text-center mb-8">
              Related <span className="text-gold-gradient">Transfers</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {NEARBY.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="bg-dark-900 border border-white/[0.08] rounded-xl p-5 hover:border-gold-500/30 transition-colors group"
                >
                  <h3 className="text-white font-semibold group-hover:text-gold-400 transition-colors mb-1">{n.name}</h3>
                  <p className="text-dark-400 text-sm">{n.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Cadaqués transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href="/book?destination=Cadaques"
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
