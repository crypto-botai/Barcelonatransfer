import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";

// Read from the price table, never restated. A repriced route reaches
// this page, its schema and the checkout together, or reaches none.
const LADDER = ladderFor("lloret", "airport")!;


const BASE = "https://www.elitebcn.info";

export const metadata: Metadata = {
  title: { absolute: `Barcelona to Lloret de Mar Transfer — from €${LADDER.economy}` },
  description:
    `Private transfer from Barcelona to Lloret de Mar. Fixed price from €${LADDER.economy}. 65-minute journey via AP-7. Meet & greet, no surge pricing. Book instantly.`,
  alternates: { canonical: `${BASE}/transfers/lloret-de-mar` },
  keywords: ["barcelona lloret de mar transfer", "lloret de mar private car barcelona", "lloret de mar airport transfer", "costa brava transfer lloret"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Lloret de Mar Transfer — from €${LADDER.economy} | Fixed Price`,
    description: `Private transfer from Barcelona to Lloret de Mar from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing. 65 minutes.`,
    url: `${BASE}/transfers/lloret-de-mar`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to Lloret de Mar Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Lloret de Mar Transfer — from €${LADDER.economy} | Elite BCN`,
    description: `Private transfer from Barcelona to Lloret de Mar from €${LADDER.economy}. Fixed price, meet & greet, no surge pricing.`,
    images: ["/opengraph-image"],
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",          item: BASE },
    { "@type": "ListItem", position: 2, name: "Transfers",     item: `${BASE}/transfers` },
    { "@type": "ListItem", position: 3, name: "Lloret de Mar", item: `${BASE}/transfers/lloret-de-mar` },
  ],
};

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Lloret de Mar Private Transfer",
  description: `Luxury fixed-price private transfer from Barcelona (city or El Prat Airport) to Lloret de Mar, Costa Brava. From €${LADDER.economy}. Flight tracking and 60 min free wait at the airport; meet & greet €5.`,
  url: `${BASE}/transfers/lloret-de-mar`,
  provider: { "@type": "LocalBusiness", name: "Elite BCN Transfers", url: BASE, telephone: "+34635383712" },
  areaServed: [
    { "@type": "City", name: "Barcelona" },
    { "@type": "City", name: "Lloret de Mar" },
  ],
  offers: { "@type": "Offer", price: String(LADDER.economy), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const FAQS = [
  {
    q: "How long is the transfer from Barcelona to Lloret de Mar?",
    a: "The private transfer from Barcelona to Lloret de Mar covers approximately 75 km via the AP-7 and C-32 motorways. Journey time is approximately 65 minutes under normal traffic conditions. Your driver monitors live traffic and adjusts the route if needed.",
  },
  {
    q: "How much does a private transfer from Barcelona to Lloret de Mar cost?",
    a: `A fixed-price private transfer from Barcelona to Lloret de Mar starts from €${LADDER.economy} for an Economy sedan (Toyota Corolla, 1–3 passengers). A Business sedan (EQE 300 Electric or Tesla Model 3) is €165, and a Mercedes V-Class for groups up to 7 is €205. Prices exclude VAT and tolls: 10% VAT is added only if you request an invoice, and AP-7 motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing. Meet & greet is an optional €5 extra.`,
  },
  {
    q: "Can Elite BCN pick us up from our Lloret de Mar hotel for the return to Barcelona?",
    a: "Yes. Every route is bidirectional at the same fixed price — book your return from any Lloret de Mar hotel, villa, or address back to Barcelona city or BCN Airport in advance to guarantee availability, especially during the July–August peak season.",
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
  { name: "Cadaqués",     href: "/transfers/cadaques",    blurb: "Dalí's whitewashed village, further up the coast" },
  { name: "Costa Brava",  href: "/transfers/costa-brava", blurb: "Tossa de Mar, Blanes, Roses and the rest of the coast" },
  { name: "Girona",       href: "/transfers/girona",      blurb: "Medieval city and Girona-Costa Brava Airport (GRO)" },
];

export default function LloretDeMarTransferPage() {
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
              <span className="text-gold-400 text-sm">Lloret de Mar</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona ⇄ Lloret de Mar
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Lloret de Mar Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer between Barcelona (city or BCN Airport) and Lloret de Mar. Fixed price, no surge pricing, ever.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 65 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 75 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{LADDER.economy} fixed</div>
            </div>
            <Link
              href="/book?destination=Lloret+de+Mar"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Lloret de Mar Transfer — €{LADDER.economy}
            </Link>
          </div>
        </section>

        {/* Why book */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">Lloret de Mar transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${LADDER.economy}`, body: "The price you see is the price you pay. No meter, no traffic surcharges, no hidden fees." },
                { icon: Clock, title: "Where your driver waits", body: "At the designated meeting point outside the terminal, next to the taxi rank, or at your Barcelona address. 60 minutes free waiting from your flight landing. A name board inside arrivals is a €5 extra." },
                { icon: Star, title: "Real-time flight tracking", body: "We monitor your flight live. If it's delayed, your driver adjusts automatically — no extra charge." },
                { icon: CheckCircle2, title: "Premium vehicles", body: "Mercedes V-Class (7 pax), EQE 300 Electric & Vito (8 pax). Air-conditioned, bottled water, WiFi on request." },
                { icon: MapPin, title: "Door-to-door service", body: "Dropped directly at your Lloret de Mar hotel, villa, or address. No sharing, no stops, no detours." },
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

        {/* About Lloret de Mar */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Lloret de Mar</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Lloret de Mar is the Costa Brava&apos;s best-known resort town, 75 km north-east of Barcelona along the AP-7 and C-32
                motorways. Its long stretch of golden sand — Platja de Lloret and neighbouring Platja de Fenals — draws families,
                groups, and sun-seekers throughout the summer, while the promenade, marina, and old town keep the destination
                lively well outside peak season too.
              </p>
              <p>
                Beyond the beaches, Lloret is home to the <strong className="text-white">Jardins de Santa Clotilde</strong>, a
                cliffside Modernist garden overlooking the Mediterranean, and sits just a short drive from
                <strong className="text-white"> Tossa de Mar</strong> and the rest of the Costa Brava&apos;s rocky coves. The town's
                nightlife district is one of the most active on the Catalan coast, and its harbour offers boat trips along the
                coastline in summer.
              </p>
              <p>
                A private transfer from Barcelona takes approximately 65 minutes — considerably more comfortable than the
                coach connections from Barcelona Nord, which typically take 80–90 minutes and require managing luggage between
                stops. Door-to-door service means you go straight from your Barcelona pickup point (or BCN Airport) to your
                Lloret de Mar hotel address without a single transfer.
              </p>
              <p>
                Because Lloret de Mar sees heavy demand in July and August, especially around check-in/check-out days
                (typically Saturdays), booking your transfer a few days in advance is recommended to guarantee vehicle
                availability at your preferred time.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {["Lloret Beach", "Santa Clotilde Gardens", "Old Town", "Marina & Nightlife"].map((item) => (
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
              Lloret de Mar Transfer <span className="text-gold-gradient">Prices</span>
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
            <p className="text-dark-500 text-xs text-center mt-4">Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet & greet, child seats and other extras are optional and charged separately.</p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Lloret de Mar Transfer <span className="text-gold-gradient">FAQs</span>
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
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Lloret de Mar transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href="/book?destination=Lloret+de+Mar"
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
