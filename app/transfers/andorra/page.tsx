import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to Andorra Transfer — from €220 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to Andorra la Vella. Fixed price from €220. 3-hour journey in Mercedes, Tesla, BMW. Ski season & shopping trips. Book instantly.",
  keywords: [
    "Barcelona airport to Andorra transfer", "BCN to Andorra private transfer",
    "transfer Barcelona Andorra la Vella", "Andorra private chauffeur",
    "transfer aeropuerto Barcelona Andorra", "Grandvalira ski transfer Barcelona",
    "Andorra ski transfer from Barcelona airport",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/andorra" },
  openGraph: {
    title: "Barcelona Airport to Andorra Transfer — from €220 | Fixed Price",
    description: "Luxury private transfer from Barcelona Airport to Andorra la Vella from €220. Fixed price, no surge pricing. Ski season specialist.",
    url: "https://www.elitebcn.info/transfers/andorra",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function AndorraTransferPage() {
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
              <span className="text-gold-400 text-sm">Andorra</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Andorra la Vella
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">Andorra Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat Airport direct to Andorra la Vella or Grandvalira ski resort.
              Fixed price €220 — no meter, no tolls surprise, no surge pricing.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> ~3 hours</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 210 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €220 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Andorra Transfer — €220
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Andorra transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "All-inclusive €220", body: "One fixed price covers the full 210 km journey including all tolls and mountain road sections. No surprises." },
                { icon: Clock, title: "Ski equipment transport", body: "Large boot space for ski bags, boot bags, and suitcases. The V-Class handles full ski kit for 4+ people." },
                { icon: Star, title: "Winter mountain driving", body: "Our drivers are experienced in Pyrenean mountain routes year-round, including winter conditions." },
                { icon: CheckCircle2, title: "Grandvalira ski station", body: "Direct drop-off at Grandvalira (Europe's largest ski area), Vallnord, or your Andorran hotel." },
                { icon: MapPin, title: "Duty-free shopping trips", body: "Use us for day-trip shopping in Andorra la Vella — we can wait and return you to Barcelona." },
                { icon: Shield, title: "No public transport alternative", body: "There is no direct bus or train from Barcelona Airport to Andorra. Private transfer is the only practical option." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Andorra</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Andorra is a tiny landlocked principality nestled in the Pyrenees between Spain and France.
                At just 468 km², it&apos;s one of Europe&apos;s smallest countries — yet it attracts over 8 million visitors
                annually thanks to its <strong className="text-white">duty-free shopping</strong>, <strong className="text-white">world-class skiing</strong>,
                and <strong className="text-white">spectacular mountain scenery</strong>.
              </p>
              <p>
                <strong className="text-white">Grandvalira</strong> is the Pyrenees&apos; largest ski area, with 210 km of pistes across 6 sectors.
                The capital <strong className="text-white">Andorra la Vella</strong> is Europe&apos;s highest capital city at 1,023 m,
                and is packed with tax-free shops for electronics, perfume, alcohol, and tobacco.
              </p>
              <p>
                There is no direct public transport from Barcelona Airport to Andorra. A private transfer is the standard
                solution — departing from arrivals and arriving at your Andorran hotel or ski hotel in approximately 3 hours.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Andorra Transfer <span className="text-gold-gradient">Prices</span></h2>
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
                    { route: "BCN Airport → Andorra la Vella (sedan)", price: "€220" },
                    { route: "BCN Airport → Andorra la Vella (MPV, 7 seats)", price: "€250" },
                    { route: "BCN Airport → Grandvalira ski resort", price: "€240" },
                    { route: "BCN Airport → Vallnord ski resort", price: "€240" },
                    { route: "Andorra la Vella → BCN Airport", price: "€220" },
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
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Andorra transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €220
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
