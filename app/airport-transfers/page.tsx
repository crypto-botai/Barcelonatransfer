import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { Plane, Anchor, Clock, Shield, Star, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport Transfer — BCN El Prat T1 & T2 | Fixed Price",
  description: "Luxury private transfer from Barcelona El Prat Airport (BCN) from €45. Meet & greet in arrivals hall, real-time flight tracking, 60 min free waiting. Mercedes, Tesla, BMW. Fixed price, no surprises.",
  alternates: { canonical: "https://www.elitebcn.info/airport-transfers" },
  openGraph: {
    title: "Barcelona Airport Transfer — BCN El Prat T1 & T2 | Fixed Price",
    description: "Private luxury transfer from Barcelona Airport from €45. Meet & greet, flight tracking, 60 min free wait. No surge pricing.",
    url: "https://www.elitebcn.info/airport-transfers",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function AirportTransfersPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <Plane size={12} /> Airport Transfers
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport <br /><span className="text-gold-gradient">Luxury Transfers</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Premium chauffeur service to and from Barcelona El Prat Airport (BCN) and Cruise Terminal. Your driver meets you in arrivals — flight monitored, sign displayed, vehicle ready.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/book?pickup=Barcelona+Airport" className="btn-gold px-8 py-4 rounded-xl font-semibold">
                Book Airport Transfer
              </Link>
              <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer" className="btn-outline-gold px-8 py-4 rounded-xl font-semibold">
                WhatsApp Quote
              </a>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Plane,    title: "Live Flight Tracking",     desc: "We monitor your flight and adjust pickup time automatically. No stress if your flight is early or delayed." },
                { icon: Clock,    title: "60-Min Free Waiting",       desc: "Complimentary 60 minutes waiting time from flight landing. For other pickups, 15 minutes is included." },
                { icon: Shield,   title: "Meet & Greet Service",     desc: "Your chauffeur meets you in the arrivals hall with a name board — helping with bags and guiding you to the vehicle." },
                { icon: Star,     title: "All Prices Fixed",          desc: "Airport transfer prices are fixed regardless of traffic or time of day. No surge pricing on holiday periods." },
                { icon: Anchor,   title: "Cruise Port Service",       desc: "Full service to Barcelona Cruise Terminal — including luggage assistance and flexible ship departure timing." },
                { icon: CheckCircle2, title: "Free Cancellation",     desc: "Cancel for free up to 24 hours before pickup. Your money is refunded in full within 5 business days." },
              ].map((f) => (
                <div key={f.title} className="glass-card gold-hover-border rounded-xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4">
                    <f.icon size={18} className="text-gold-500" />
                  </div>
                  <h3 className="text-white font-medium mb-2">{f.title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prices table preview */}
        <section className="py-16 bg-[#070707]">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Fixed Airport Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="glass-card rounded-2xl overflow-hidden max-w-3xl mx-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-5 text-xs text-dark-400 uppercase tracking-wider">Route</th>
                    <th className="text-center py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">From</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["El Prat Airport ⇄ Barcelona City",  "€50"],
                    ["El Prat Airport ⇄ Cruise Terminal", "€50"],
                    ["Cruise Terminal ⇄ Barcelona City",  "€50"],
                    ["El Prat Airport ⇄ Sants Station",   "€55"],
                    ["Barcelona ⇄ Girona Airport",        "€140"],
                  ].map(([route, price]) => (
                    <tr key={route} className="price-row border-b border-white/[0.04]">
                      <td className="py-4 px-5 text-sm text-dark-200">{route}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-gold-400 font-semibold">{price}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 border-t border-white/[0.06] text-center">
                <Link href="/pricing" className="text-gold-500 text-sm hover:text-gold-400 transition-colors">
                  View all destinations →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
