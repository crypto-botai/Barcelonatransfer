import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Airport to Tarragona Transfer — from €95 | Fixed Price",
  description:
    "Luxury private transfer from Barcelona Airport (BCN) to Tarragona or PortAventura World. Fixed price from €95. 1-hour journey in Mercedes, Tesla, BMW. Meet & greet included.",
  keywords: [
    "Barcelona airport to Tarragona transfer", "BCN to Tarragona private transfer",
    "Barcelona airport to PortAventura transfer", "PortAventura private transfer",
    "transfer aeropuerto Barcelona Tarragona", "Tarragona private chauffeur",
  ],
  alternates: { canonical: "https://www.elitebcn.info/transfers/tarragona" },
  openGraph: {
    title: "Barcelona Airport to Tarragona Transfer — from €95 | Fixed Price",
    description: "Luxury private transfer Barcelona Airport to Tarragona or PortAventura from €95. Fixed price, no surge pricing.",
    url: "https://www.elitebcn.info/transfers/tarragona",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function TarragonaTransferPage() {
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
              <span className="text-gold-400 text-sm">Tarragona</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Tarragona
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">Tarragona Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat Airport to Tarragona city or PortAventura World.
              Fixed price, no meter running. Door-to-door in 60 minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> ~1 hour</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 90 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €95 fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Tarragona Transfer — €95
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Tarragona transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed price €95", body: "One price covers the full journey including all AP-7 motorway tolls. No hidden charges." },
                { icon: Clock, title: "PortAventura door delivery", body: "Drop-off directly at your PortAventura World hotel or theme park entrance. No stress with luggage on buses." },
                { icon: Star, title: "Costa Daurada hotels", body: "We serve all resort hotels along the Costa Daurada — Cambrils, Salou, La Pineda, and Vila-seca." },
                { icon: CheckCircle2, title: "7-seat MPV available", body: "The Mercedes V-Class seats 7 passengers and handles large luggage — ideal for family groups." },
                { icon: MapPin, title: "Roman heritage Tarragona", body: "Direct drop to Tarragona's UNESCO amphitheatre, historic centre, or any hotel in the city." },
                { icon: Shield, title: "Instant booking confirmation", body: "Book online and receive your confirmation email and driver details within minutes." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Tarragona</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Tarragona is a UNESCO World Heritage city 90 km southwest of Barcelona, home to the most spectacular Roman remains in Spain —
                including a <strong className="text-white">Roman amphitheatre overlooking the sea</strong>, a triumphal arch, and an aqueduct.
              </p>
              <p>
                The city sits at the heart of the <strong className="text-white">Costa Daurada</strong> (Golden Coast), Catalonia's sunniest coastal stretch.
                Just 10 minutes from Tarragona city is <strong className="text-white">PortAventura World</strong> — Spain's #1 theme park resort,
                hosting PortAventura Theme Park, Ferrari Land, and Caribe Aquatic Park.
              </p>
              <p>
                A private transfer takes approximately 60 minutes versus 1–1.5 hours by train with connections,
                and is the only practical option for families travelling with luggage to a resort hotel.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Tarragona Transfer <span className="text-gold-gradient">Prices</span></h2>
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
                    { route: "BCN Airport → Tarragona City (sedan)", price: "€95" },
                    { route: "BCN Airport → Tarragona City (MPV, 7 seats)", price: "€115" },
                    { route: "BCN Airport → PortAventura World", price: "€99" },
                    { route: "BCN Airport → Salou / La Pineda", price: "€99" },
                    { route: "Tarragona City → BCN Airport", price: "€95" },
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
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Tarragona transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €95
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
