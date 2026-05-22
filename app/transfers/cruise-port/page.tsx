import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight, Anchor } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Cruise Port Transfer — World Trade Centre & Moll Adossat | from €45",
  description:
    "Luxury private transfer to Barcelona cruise port. World Trade Centre (T-A to T-D) & Moll Adossat. Vessel tracking, meet & greet, fixed price from €45. Book instantly 24/7.",
  keywords: [
    "Barcelona cruise port transfer", "Barcelona cruise terminal transfer",
    "World Trade Centre Barcelona transfer", "Moll Adossat transfer",
    "Barcelona port cruise private transfer", "transfer puerto cruceros Barcelona",
    "cruise ship transfer Barcelona airport",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/cruise-port" },
  openGraph: {
    title: "Barcelona Cruise Port Transfer — from €45 | Fixed Price",
    description: "Luxury private transfer to Barcelona cruise terminals (WTC & Moll Adossat) from €45. Vessel tracking, meet & greet, no surge pricing.",
    url: "https://www.elitebcn.info/transfers/cruise-port",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function CruisePortTransferPage() {
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
              <span className="text-gold-400 text-sm">Cruise Port</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <Anchor size={12} /> Barcelona Cruise Port
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona <br /><span className="text-gold-gradient">Cruise Port Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfers to and from all Barcelona cruise terminals.
              We track your vessel&apos;s arrival time and wait for free — so you&apos;re never rushed.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 20 minutes from BCN Airport</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 10 km from city centre</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €45 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Cruise Port Transfer — from €45
            </Link>
          </div>
        </section>

        {/* Terminal guide */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Barcelona Cruise <span className="text-gold-gradient">Terminals Guide</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { code: "Terminal A", name: "World Trade Centre North", location: "Moll de Barcelona, Barcelona Vell" },
                { code: "Terminal B", name: "World Trade Centre South", location: "Moll de Barcelona, Barcelona Vell" },
                { code: "Terminal C", name: "Moll Adossat — Terminal C", location: "Zona Franca, 4 km from city" },
                { code: "Terminal D", name: "Moll Adossat — Terminal D", location: "Zona Franca, 4 km from city" },
                { code: "Terminal E", name: "Moll Adossat — Terminal E", location: "Zona Franca, 4 km from city" },
              ].map((t) => (
                <div key={t.code} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold px-2 py-1 rounded">{t.code}</span>
                    <span className="text-white font-medium text-sm">{t.name}</span>
                  </div>
                  <p className="text-dark-400 text-xs">{t.location}</p>
                </div>
              ))}
            </div>
            <p className="text-dark-400 text-sm text-center mt-6">
              Not sure which terminal? Enter your cruise line when booking and we&apos;ll confirm the correct terminal for your vessel.
            </p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">cruise transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Anchor, title: "Vessel arrival tracking", body: "We monitor your ship&apos;s AIS position and adjust driver dispatch based on actual docking time — not scheduled time." },
                { icon: Clock, title: "60 min free waiting", body: "Disembarkation takes time. Your driver waits 60 minutes for free. Additional waiting charged at €15/30 min." },
                { icon: Shield, title: "Port security clearance", body: "Our drivers are pre-registered for all Barcelona port terminals and know exactly where to meet you post-customs." },
                { icon: Star, title: "Pre-cruise airport runs", body: "Transfer from BCN Airport to your cruise terminal in just 20 minutes. Ideal for same-day arrivals." },
                { icon: CheckCircle2, title: "Large luggage handled", body: "Cruise luggage is heavy. The V-Class handles 7 passengers with full-size suitcases per person." },
                { icon: MapPin, title: "Hotel to terminal", body: "Pre-cruise transfer from any Barcelona hotel to your terminal with your chosen departure time." },
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

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Cruise Port <span className="text-gold-gradient">Transfer Prices</span></h2>
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
                    { route: "BCN Airport → Cruise Port (sedan)", price: "€45" },
                    { route: "BCN Airport → Cruise Port (MPV, 7 seats)", price: "€60" },
                    { route: "Cruise Port → BCN Airport (sedan)", price: "€45" },
                    { route: "Barcelona City Hotel → Cruise Port", price: "€35" },
                    { route: "Cruise Port → Sitges", price: "€65" },
                    { route: "Cruise Port → Tarragona / PortAventura", price: "€95" },
                  ].map((row) => (
                    <tr key={row.route} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">All prices include meet & greet and 60 min free waiting. No hidden fees.</p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your cruise port transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €45
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
