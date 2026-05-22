import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to Girona Transfer — from €110 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to Girona city or Girona Costa Brava Airport (GRO). Fixed price from €110. 1 hr 10 min. Mercedes, Tesla, BMW. Book instantly.",
  keywords: [
    "Barcelona airport to Girona transfer", "BCN to Girona private transfer", "transfer Barcelona Girona",
    "Girona airport transfer", "transfer aeropuerto Barcelona Girona", "Girona private chauffeur",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/girona" },
  openGraph: {
    title: "Barcelona Airport to Girona Transfer — from €110 | Fixed Price",
    description: "Luxury private transfer Barcelona to Girona from €110. Fixed price, meet & greet, no surge pricing.",
    url: "https://www.elitebcn.info/transfers/girona",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function GironaTransferPage() {
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
              <span className="text-gold-400 text-sm">Girona</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Girona
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">Girona Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat to Girona city or Girona-Costa Brava Airport (GRO).
              Fixed price, no surge pricing. Direct door-to-door service.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 1 hr 10 min</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 100 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €110 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Girona Transfer — €110
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Girona transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed price €110", body: "The price includes the full motorway journey, all tolls, and no surprise surcharges at destination." },
                { icon: Clock, title: "Meet & greet included", body: "Driver meets you in arrivals with your name board. 60 minutes free waiting from your flight landing." },
                { icon: Star, title: "Girona Airport (GRO) transfers", body: "We also transfer between Girona Airport and Barcelona city — useful for Ryanair passengers flying into GRO." },
                { icon: CheckCircle2, title: "Medieval city drop-off", body: "Direct to your Girona hotel, apartment, or the historic quarter without navigating public transport." },
                { icon: MapPin, title: "Costa Brava access", body: "Girona is the gateway to the Costa Brava. We can continue to Tossa de Mar, Lloret de Mar, or Cadaqués." },
                { icon: Shield, title: "Licensed VTC operator", body: "Fully licensed VTC under Generalitat de Catalunya. Professionally insured for all passengers." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Girona</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Girona is one of Spain's most beautifully preserved medieval cities, with a UNESCO-protected old quarter, a famous Jewish heritage district (El Call), and a stunning cathedral that featured in Game of Thrones.
              </p>
              <p>
                Located 100 km north of Barcelona via the AP-7 motorway, Girona is also home to <strong className="text-white">Girona-Costa Brava Airport (GRO)</strong> — a key Ryanair hub serving millions of passengers who then need onward transport to Barcelona.
              </p>
              <p>
                A private transfer is the most efficient way to travel between the two cities, taking around 70 minutes versus 1.5–2 hours by train (including connections to Barcelona Sants).
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Girona Transfer <span className="text-gold-gradient">Prices</span></h2>
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
                    { route: "BCN Airport → Girona City (sedan)", price: "€110" },
                    { route: "BCN Airport → Girona City (MPV, 7 seats)", price: "€130" },
                    { route: "BCN Airport → Girona Airport (GRO)", price: "€120" },
                    { route: "Girona City → BCN Airport", price: "€110" },
                  ].map((row) => (
                    <tr key={row.route} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">All prices include tolls, meet & greet, and 60 min free waiting. No hidden fees.</p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Girona transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €110
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
