import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { MapPin, ChevronRight, Clock, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Barcelona Private Transfer Destinations — All Routes & Prices",
  description:
    "Private luxury transfers from Barcelona to all major destinations: Sitges, Girona, Tarragona, Andorra, Costa Brava, Montserrat, cruise port & more. Fixed prices, no surge pricing.",
  alternates: { canonical: "https://www.elitebcn.info/transfers" },
  openGraph: {
    title: "Barcelona Private Transfer Destinations — All Routes & Prices",
    description: "Fixed-price luxury private transfers from Barcelona Airport to Sitges, Girona, Tarragona, Andorra, Costa Brava, Montserrat and more.",
    url: "https://www.elitebcn.info/transfers",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

const DESTINATIONS = [
  {
    slug: "sitges",
    name: "Sitges",
    tagline: "Barcelona's glamorous coastal resort",
    price: 65,
    duration: "35 min",
    distance: "35 km",
    description: "The jewel of the Garraf coast. Gateway to the famous Sitges Carnival, Film Festival, and year-round beach scene.",
    highlights: ["Sitges Beach & Old Town", "Sitges Carnival (Feb)", "Sitges Film Festival (Oct)", "Gay-friendly resort"],
  },
  {
    slug: "girona",
    name: "Girona",
    tagline: "Medieval city & Costa Brava gateway",
    price: 110,
    duration: "1 hr 10 min",
    distance: "100 km",
    description: "UNESCO-listed medieval quarter, the famous Girona Cathedral, and gateway to the wild Costa Brava.",
    highlights: ["Girona Cathedral", "Jewish Quarter (El Call)", "Girona Airport (GRO)", "Costa Brava access"],
  },
  {
    slug: "tarragona",
    name: "Tarragona",
    tagline: "Roman ruins & PortAventura theme park",
    price: 95,
    duration: "1 hr",
    distance: "90 km",
    description: "UNESCO Roman remains, a stunning amphitheatre on the sea, and PortAventura World theme park next door.",
    highlights: ["Tarragona Amphitheatre", "PortAventura World", "Roman Aqueduct", "Costa Daurada beaches"],
  },
  {
    slug: "montserrat",
    name: "Montserrat",
    tagline: "Catalonia's sacred mountain monastery",
    price: 85,
    duration: "50 min",
    distance: "50 km",
    description: "The striking serrated mountain housing the famous Black Madonna and the Benedictine monastery of Montserrat.",
    highlights: ["Montserrat Monastery", "Black Madonna shrine", "Hiking & cable car", "Panoramic views"],
  },
  {
    slug: "costa-brava",
    name: "Costa Brava",
    tagline: "Wild coastline of rugged cliffs & coves",
    price: 130,
    duration: "1 hr 30 min",
    distance: "130 km",
    description: "The 'Wild Coast' — stunning cliffs, hidden coves, Dalí museums, and charming fishing villages from Tossa de Mar to Cadaqués.",
    highlights: ["Tossa de Mar", "Cadaqués & Cap de Creus", "Dalí Theatre-Museum (Figueres)", "GR 92 coastal path"],
  },
  {
    slug: "andorra",
    name: "Andorra",
    tagline: "Tax-free Pyrenean principality",
    price: 220,
    duration: "3 hr",
    distance: "210 km",
    description: "The tiny tax-free Pyrenean principality famous for ski resorts, duty-free shopping, and dramatic mountain scenery.",
    highlights: ["Grandvalira ski resort", "Duty-free shopping", "Andorra la Vella capital", "Caldea spa"],
  },
  {
    slug: "cruise-port",
    name: "Barcelona Cruise Port",
    tagline: "World Trade Centre & Moll Adossat terminals",
    price: 45,
    duration: "20 min",
    distance: "10 km",
    description: "Meet-and-greet transfers to all of Barcelona's cruise terminals. We track your vessel arrival and wait for free.",
    highlights: ["World Trade Centre terminal", "Moll Adossat (T-A to T-D)", "Vessel tracking", "60 min free wait"],
  },
  {
    slug: "port-aventura",
    name: "PortAventura World",
    tagline: "Spain's #1 theme park resort",
    price: 99,
    duration: "1 hr 10 min",
    distance: "95 km",
    description: "Direct private transfers to Spain's most-visited theme park resort — PortAventura, Ferrari Land & Caribe Aquatic Park.",
    highlights: ["PortAventura Theme Park", "Ferrari Land", "Caribe Aquatic Park", "Port Aventura Hotels"],
  },
];

export default function TransfersHubPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> All Destinations
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Barcelona <span className="text-gold-gradient">Transfer Routes</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto text-lg">
              Fixed-price luxury private transfers from Barcelona Airport to every major destination in Catalonia and beyond.
              No surge pricing. No surprises.
            </p>
          </div>
        </section>

        {/* Destination grid */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DESTINATIONS.map((dest) => (
                <Link
                  key={dest.slug}
                  href={`/transfers/${dest.slug}`}
                  className="group block bg-dark-900 border border-white/[0.08] rounded-xl p-6 hover:border-gold-500/40 transition-all duration-300 hover:bg-dark-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-white font-semibold text-xl group-hover:text-gold-400 transition-colors">
                        {dest.name}
                      </h2>
                      <p className="text-dark-400 text-sm">{dest.tagline}</p>
                    </div>
                    <ChevronRight size={18} className="text-dark-500 group-hover:text-gold-500 mt-1 transition-colors flex-shrink-0" />
                  </div>
                  <p className="text-dark-300 text-sm mb-4 leading-relaxed">{dest.description}</p>
                  <div className="flex items-center gap-4 text-xs text-dark-400 mb-4">
                    <span className="flex items-center gap-1"><Clock size={12} /> {dest.duration}</span>
                    <span className="flex items-center gap-1"><MapPin size={12} /> {dest.distance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold-400 font-semibold text-lg">from €{dest.price}</span>
                    <span className="text-xs text-dark-500 bg-dark-800 border border-white/[0.06] rounded px-2 py-1">
                      Fixed price
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl sm:text-4xl text-white mb-4">
              Don&apos;t see your destination?
            </h2>
            <p className="text-dark-400 mb-8 max-w-xl mx-auto">
              We serve the whole of Catalonia and beyond. Get an instant quote for any pickup or drop-off location.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-8 py-4 rounded-lg transition-colors"
            >
              Get Instant Quote <ChevronRight size={18} />
            </Link>
          </div>
        </section>

        {/* Trust signals */}
        <section className="py-12 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-8 text-center">
              {[
                { icon: Star, label: "4.9★ Rating", sub: "500+ reviews" },
                { icon: Clock, label: "24/7 Available", sub: "All flights & arrivals" },
                { icon: MapPin, label: "Fixed Prices", sub: "No surge pricing" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <Icon size={24} className="text-gold-500" />
                  <span className="text-white font-semibold">{label}</span>
                  <span className="text-dark-400 text-sm">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
