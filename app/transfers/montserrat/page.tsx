import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to Montserrat Transfer — from €85 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to Montserrat monastery. Fixed price from €85. 50-minute journey. Meet & greet, no surge pricing. Book instantly.",
  keywords: [
    "Barcelona airport to Montserrat transfer", "BCN to Montserrat private transfer",
    "Montserrat private transfer", "transfer aeropuerto Barcelona Montserrat",
    "Montserrat monastery transfer", "Montserrat day trip Barcelona",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/montserrat" },
  openGraph: {
    title: "Barcelona Airport to Montserrat Transfer — from €85 | Fixed Price",
    description: "Luxury private transfer Barcelona Airport to Montserrat monastery from €85. Fixed price, no surge pricing.",
    url: "https://www.elitebcn.info/transfers/montserrat",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function MontserratTransferPage() {
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
              <span className="text-gold-400 text-sm">Montserrat</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Montserrat
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">Montserrat Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat Airport direct to Montserrat monastery.
              Fixed price from €85, no surge pricing, no stress.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 50 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 50 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €85 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Montserrat Transfer — €85
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Montserrat transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed price €85", body: "Price includes the mountain roads, no meter, no surprises. Drop at the monastery parking or Aeri cable car station." },
                { icon: Clock, title: "Day-trip return included", body: "Book a return transfer for your chosen time. We wait while you explore — hourly waiting rate applies after 60 min." },
                { icon: Star, title: "Direct from airport", body: "Start your Montserrat visit directly from the airport without going into Barcelona first." },
                { icon: CheckCircle2, title: "Monastery access points", body: "Drop at the main monastery plaza, Aeri cable car base, or rack railway (Cremallera) station at Monistrol." },
                { icon: MapPin, title: "Barcelona city pickup too", body: "Prefer to start from your Barcelona hotel? We offer pickup from any city address." },
                { icon: Shield, title: "Child seats available", body: "Baby seats and child booster seats available on request at no extra charge." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Montserrat</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Montserrat — meaning "serrated mountain" — is Catalonia's most sacred site and one of Spain's most visited destinations.
                The striking multi-peaked mountain rises dramatically from the plains 50 km northwest of Barcelona,
                home to a 9th-century Benedictine monastery and the revered <strong className="text-white">Black Madonna (La Moreneta)</strong>.
              </p>
              <p>
                Over a million pilgrims and tourists visit each year to venerate the Black Madonna, watch the famous
                <strong className="text-white"> Escolania boys' choir</strong> (one of Europe's oldest), and hike the network of mountain trails
                with panoramic views over Catalonia.
              </p>
              <p>
                A private transfer from Barcelona Airport is the most comfortable option — arriving directly at the monastery
                without navigating train connections to Manresa or Monistrol de Montserrat.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Montserrat Transfer <span className="text-gold-gradient">Prices</span></h2>
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
                    { route: "BCN Airport → Montserrat (sedan)", price: "€85" },
                    { route: "BCN Airport → Montserrat (MPV, 7 seats)", price: "€105" },
                    { route: "Barcelona City → Montserrat (sedan)", price: "€75" },
                    { route: "Montserrat → BCN Airport", price: "€85" },
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
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Montserrat transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €85
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
