import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to PortAventura Transfer — from €99 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to PortAventura World theme park. Fixed price from €99. 70-minute journey. Families welcome, luggage included. Book instantly.",
  keywords: [
    "Barcelona airport to PortAventura transfer", "BCN to PortAventura private transfer",
    "PortAventura World transfer from airport", "transfer aeropuerto Barcelona PortAventura",
    "Ferrari Land transfer Barcelona airport", "PortAventura private chauffeur",
    "Salou transfer from Barcelona airport",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/port-aventura" },
  openGraph: {
    title: "Barcelona Airport to PortAventura Transfer — from €99 | Fixed Price",
    description: "Luxury private transfer from Barcelona Airport to PortAventura World from €99. Fixed price, family-friendly, no surge pricing.",
    url: "https://www.elitebcn.info/transfers/port-aventura",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function PortAventuraTransferPage() {
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
              <span className="text-gold-400 text-sm">PortAventura</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → PortAventura World
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">PortAventura Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat Airport directly to PortAventura World, Ferrari Land, or your Costa Daurada hotel.
              Fixed price from €99 — ideal for families.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 70 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 95 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €99 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book PortAventura Transfer — €99
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">PortAventura transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed price €99", body: "Single all-inclusive price. No meter running, no toll surprises, no extra charge for luggage." },
                { icon: CheckCircle2, title: "Child seats available", body: "Free baby seats and booster seats on request — essential for families flying in with young children." },
                { icon: Star, title: "Direct to theme park gate", body: "Drop-off at PortAventura main entrance, Ferrari Land entrance, or your on-site hotel lobby." },
                { icon: Clock, title: "Meet & greet in arrivals", body: "Driver waits with your name board in the arrivals hall. 60 minutes free waiting from your flight landing." },
                { icon: MapPin, title: "All Costa Daurada hotels", body: "We drop at any resort hotel in Salou, Cambrils, La Pineda, or Vila-seca on the same journey." },
                { icon: Shield, title: "7-seat MPV for families", body: "The Mercedes V-Class comfortably fits 2 adults + children with prams, luggage, and child seats." },
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

        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">PortAventura World</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                PortAventura World is Spain&apos;s #1 theme park resort and the 4th most visited in Europe,
                located 95 km southwest of Barcelona near the town of Salou on the Costa Daurada.
              </p>
              <p>
                The resort comprises three parks: <strong className="text-white">PortAventura Theme Park</strong> (6 themed worlds including Polynesia, Far West, China, Mexico, and SésamoAventura),
                <strong className="text-white"> Ferrari Land</strong> (Europe&apos;s only Ferrari theme park), and
                <strong className="text-white"> Caribe Aquatic Park</strong> (open summer season).
              </p>
              <p>
                The journey by private transfer takes approximately 70 minutes via the AP-7 motorway — compared to 1.5–2 hours by a combination of train and shuttle bus, which is impractical with family luggage.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">PortAventura Transfer <span className="text-gold-gradient">Prices</span></h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Route</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { route: "BCN Airport → PortAventura World (sedan)", price: "€99" },
                    { route: "BCN Airport → PortAventura World (MPV, 7 seats)", price: "€120" },
                    { route: "BCN Airport → Ferrari Land entrance", price: "€99" },
                    { route: "BCN Airport → Salou / La Pineda resort hotels", price: "€99" },
                    { route: "PortAventura World → BCN Airport", price: "€99" },
                  ].map((row) => (
                    <tr key={row.route} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">All prices include all tolls, meet & greet, and 60 min free waiting. No hidden fees.</p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your PortAventura transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €99
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
