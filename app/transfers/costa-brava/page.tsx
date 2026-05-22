import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to Costa Brava Transfer — from €130 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to Costa Brava — Tossa de Mar, Lloret, Cadaqués, Roses, L'Escala. Fixed prices from €130. Meet & greet, no surge pricing.",
  keywords: [
    "Barcelona airport to Costa Brava transfer", "BCN to Costa Brava private transfer",
    "Barcelona to Tossa de Mar transfer", "Barcelona to Lloret de Mar transfer",
    "Barcelona to Cadaqués transfer", "Costa Brava private chauffeur",
    "transfer aeropuerto Barcelona Costa Brava",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/costa-brava" },
  openGraph: {
    title: "Barcelona Airport to Costa Brava Transfer — from €130 | Fixed Price",
    description: "Luxury private transfer from Barcelona Airport to Costa Brava from €130. Tossa de Mar, Lloret, Cadaqués, Roses. Fixed price.",
    url: "https://www.elitebcn.info/transfers/costa-brava",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function CostaBravaTransferPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
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
              Barcelona Airport to <br /><span className="text-gold-gradient">Costa Brava Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfers from BCN El Prat to the entire Costa Brava coastline.
              Tossa de Mar, Lloret de Mar, Cadaqués, Roses, L&apos;Escala and beyond — all at fixed prices.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 1.5–2.5 hrs</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 100–200 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €130 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Costa Brava Transfer
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Costa Brava <span className="text-gold-gradient">Transfer Prices</span></h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Destination</th>
                    <th className="text-left text-dark-400 font-medium p-4">Distance</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { dest: "Tossa de Mar", km: "100 km", price: "€130" },
                    { dest: "Lloret de Mar", km: "95 km", price: "€125" },
                    { dest: "Platja d'Aro", km: "115 km", price: "€140" },
                    { dest: "Palamós", km: "130 km", price: "€150" },
                    { dest: "Begur / Pals", km: "145 km", price: "€160" },
                    { dest: "L'Escala / Empúries", km: "160 km", price: "€170" },
                    { dest: "Roses", km: "170 km", price: "€180" },
                    { dest: "Cadaqués", km: "195 km", price: "€200" },
                  ].map((row) => (
                    <tr key={row.dest} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.dest}</td>
                      <td className="p-4 text-dark-400">{row.km}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">Prices are for a standard sedan. MPV (7 seats) add €20. All prices include tolls & meet & greet.</p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About the <span className="text-gold-gradient">Costa Brava</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                The Costa Brava ("Wild Coast") stretches 214 km from Blanes north to the French border —
                a dramatic landscape of rugged cliffs, hidden coves, pine forests, and charming fishing villages.
                It&apos;s one of Europe&apos;s most beautiful coastlines and a world-class destination for sailing, hiking, and gastronomy.
              </p>
              <p>
                Key highlights include <strong className="text-white">Tossa de Mar</strong> (medieval walled town),
                <strong className="text-white"> Cadaqués</strong> (Salvador Dalí&apos;s home, Cap de Creus National Park),
                <strong className="text-white"> Empúries</strong> (Greek and Roman ruins on the beach), and
                the <strong className="text-white">Dalí Theatre-Museum</strong> in Figueres.
              </p>
              <p>
                There is no practical direct public transport from Barcelona Airport to most Costa Brava destinations.
                A private transfer is by far the most efficient option.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Costa Brava transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "All-inclusive fixed prices", body: "Single price covers the full journey — motorway tolls, fuel, and driver. No surprises." },
                { icon: Clock, title: "Direct door-to-door", body: "Straight to your villa, hotel, or port — no bus stops, no changes, no shared rides." },
                { icon: Star, title: "Large luggage handled", body: "The V-Class fits 7 passengers plus large suitcases — ideal for multi-week Costa Brava stays." },
                { icon: CheckCircle2, title: "Child seats available", body: "Baby seats and boosters available on request. Travel safely with your whole family." },
                { icon: MapPin, title: "Return transfers", body: "Book your outbound and return together. We arrive at your villa exactly when you need us." },
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

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Costa Brava transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €130
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
