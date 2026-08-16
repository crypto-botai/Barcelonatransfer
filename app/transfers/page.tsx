import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, ChevronRight, Clock, Star } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";
import { SOCIAL_PROOF } from "@/lib/company-facts";
import destinations from "@/data/destinations.json";
import { getDestinationPrices, SLUG_TO_ZONE } from "@/lib/destination-pricing";

/**
 * Full index of the programmatic destination pages, grouped by type.
 *
 * Without this, those pages were only reachable through the "nearby" links on
 * other destination pages — so any destination that no other entry happened to
 * list as nearby (Barceló Raval, Ayre Rosellón, Nobu) had zero inbound links
 * and was effectively invisible to crawlers despite sitting in the sitemap.
 */
const TYPE_GROUPS: { type: string; heading: string }[] = [
  { type: "hotel",  heading: "Hotel transfers" },
  { type: "cruise", heading: "Cruise line transfers" },
  { type: "event",  heading: "Event & venue transfers" },
  { type: "route",  heading: "Long-distance routes" },
];

export const metadata: Metadata = {
  title: { absolute: "Barcelona Private Transfer Destinations | Elite BCN" },
  description:
    "Luxury transfers from Barcelona to Sitges, Girona, Tarragona, Andorra, Costa Brava, Montserrat, cruise port & more. Fixed prices, no surge pricing.",
  alternates: { canonical: "https://www.elitebcn.info/transfers" },
  keywords: ["barcelona transfer destinations", "barcelona to sitges transfer", "barcelona to girona transfer", "barcelona andorra transfer", "barcelona costa brava transfer"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Private Transfer Destinations | Elite BCN",
    description: "Fixed-price luxury private transfers from Barcelona Airport to Sitges, Girona, Tarragona, Andorra, Costa Brava, Montserrat and more.",
    url: "https://www.elitebcn.info/transfers",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona Transfer Routes & Destinations" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Private Transfer Destinations | Elite BCN",
    description: "Fixed-price luxury private transfers from Barcelona Airport to Sitges, Girona, Tarragona, Andorra, Costa Brava and more.",
    images: ["/opengraph-image"],
  },
};

const transfersHubSchema = {
  "@context": "https://schema.org",
  "@type":    "CollectionPage",
  "@id":      "https://www.elitebcn.info/transfers",
  url:        "https://www.elitebcn.info/transfers",
  name:       "Barcelona Private Transfer Destinations",
  description: "Fixed-price luxury private transfers from Barcelona to all major destinations in Catalonia and beyond.",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",         item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.elitebcn.info/transfers" },
    ],
  },
  hasPart: [
    { "@type": "WebPage", name: "Barcelona to Sitges Transfer",      url: "https://www.elitebcn.info/transfers/sitges" },
    { "@type": "WebPage", name: "Barcelona to Girona Transfer",      url: "https://www.elitebcn.info/transfers/girona" },
    { "@type": "WebPage", name: "Barcelona to Tarragona Transfer",   url: "https://www.elitebcn.info/transfers/tarragona" },
    { "@type": "WebPage", name: "Barcelona to Andorra Transfer",     url: "https://www.elitebcn.info/transfers/andorra" },
    { "@type": "WebPage", name: "Barcelona to Lourdes Transfer",     url: "https://www.elitebcn.info/transfers/lourdes" },
    { "@type": "WebPage", name: "Barcelona Costa Brava Transfers",   url: "https://www.elitebcn.info/transfers/costa-brava" },
    { "@type": "WebPage", name: "Barcelona Cruise Port Transfer",    url: "https://www.elitebcn.info/transfers/cruise-port" },
    { "@type": "WebPage", name: "Barcelona to Montserrat Transfer",  url: "https://www.elitebcn.info/transfers/montserrat" },
    { "@type": "WebPage", name: "Barcelona PortAventura Transfer",   url: "https://www.elitebcn.info/transfers/port-aventura" },
    { "@type": "WebPage", name: "Barcelona Costa Dorada Transfers",  url: "https://www.elitebcn.info/transfers/costa-dorada" },
  ],
};

const DESTINATIONS = [
  {
    slug: "sitges",
    name: "Sitges",
    tagline: "Barcelona's glamorous coastal resort",
    duration: "35 min",
    distance: "35 km",
    description: "The jewel of the Garraf coast. Gateway to the famous Sitges Carnival, Film Festival, and year-round beach scene.",
    highlights: ["Sitges Beach & Old Town", "Sitges Carnival (Feb)", "Sitges Film Festival (Oct)", "Gay-friendly resort"],
  },
  {
    slug: "girona",
    name: "Girona",
    tagline: "Medieval city & Costa Brava gateway",
    duration: "1 hr 10 min",
    distance: "100 km",
    description: "UNESCO-listed medieval quarter, the famous Girona Cathedral, and gateway to the wild Costa Brava.",
    highlights: ["Girona Cathedral", "Jewish Quarter (El Call)", "Girona Airport (GRO)", "Costa Brava access"],
  },
  {
    slug: "tarragona",
    name: "Tarragona",
    tagline: "Roman ruins & PortAventura theme park",
    duration: "1 hr",
    distance: "90 km",
    description: "UNESCO Roman remains, a stunning amphitheatre on the sea, and PortAventura World theme park next door.",
    highlights: ["Tarragona Amphitheatre", "PortAventura World", "Roman Aqueduct", "Costa Daurada beaches"],
  },
  {
    slug: "montserrat",
    name: "Montserrat",
    tagline: "Catalonia's sacred mountain monastery",
    duration: "50 min",
    distance: "50 km",
    description: "The striking serrated mountain housing the famous Black Madonna and the Benedictine monastery of Montserrat.",
    highlights: ["Montserrat Monastery", "Black Madonna shrine", "Hiking & cable car", "Panoramic views"],
  },
  {
    slug: "costa-brava",
    name: "Costa Brava",
    tagline: "Wild coastline of rugged cliffs & coves",
    duration: "1 hr 30 min",
    distance: "130 km",
    description: "The 'Wild Coast' — stunning cliffs, hidden coves, Dalí museums, and charming fishing villages from Tossa de Mar to Cadaqués.",
    highlights: ["Tossa de Mar", "Cadaqués & Cap de Creus", "Dalí Theatre-Museum (Figueres)", "GR 92 coastal path"],
  },
  {
    slug: "andorra",
    name: "Andorra",
    tagline: "Tax-free Pyrenean principality",
    duration: "3 hr",
    distance: "210 km",
    description: "The tiny tax-free Pyrenean principality famous for ski resorts, duty-free shopping, and dramatic mountain scenery.",
    highlights: ["Grandvalira ski resort", "Duty-free shopping", "Andorra la Vella capital", "Caldea spa"],
  },
  {
    slug: "lourdes",
    name: "Lourdes",
    tagline: "France's great pilgrimage sanctuary",
    duration: "6 hr",
    distance: "415 km",
    description: "The Pyrenean sanctuary where Bernadette Soubirous reported the 1858 apparitions — six million pilgrims a year, and no direct train or flight from Barcelona.",
    highlights: ["Grotto of Massabielle", "Basilica of the Rosary", "Torchlight Marian procession", "Accessible & group vehicles"],
  },
  {
    slug: "cruise-port",
    name: "Barcelona Cruise Port",
    tagline: "World Trade Centre & Moll Adossat terminals",
    duration: "20 min",
    distance: "10 km",
    description: "Meet-and-greet transfers to all of Barcelona's cruise terminals. We track your vessel arrival and wait for free.",
    highlights: ["World Trade Centre terminal", "Moll Adossat (T-A to T-D)", "Vessel tracking", "60 min free wait"],
  },
  {
    slug: "port-aventura",
    name: "PortAventura World",
    tagline: "Spain's #1 theme park resort",
    duration: "1 hr 10 min",
    distance: "95 km",
    description: "Direct private transfers to Spain's most-visited theme park resort — PortAventura, Ferrari Land & Caribe Aquatic Park.",
    highlights: ["PortAventura Theme Park", "Ferrari Land", "Caribe Aquatic Park", "Port Aventura Hotels"],
  },
  {
    slug: "costa-dorada",
    name: "Costa Dorada",
    tagline: "Golden beaches south of Barcelona",
    duration: "1 hr",
    distance: "90 km",
    description: "The 'Golden Coast' — Sitges, Tarragona, Salou, PortAventura and Cambrils, all covered by one fixed-price transfer service.",
    highlights: ["Sitges & Tarragona", "Salou & Cambrils", "PortAventura access", "Costa Dorada beaches"],
  },
  {
    slug: "figueres",
    name: "Figueres",
    tagline: "The Dalí Theatre-Museum",
    duration: "1 hr 40 min",
    distance: "140 km",
    description: "Home of the Dalí Theatre-Museum, built by the artist himself inside a burned-out theatre — and his burial place.",
    highlights: ["Dalí Theatre-Museum", "Castell de Sant Ferran", "Toy Museum", "Empordà wine country"],
  },
  {
    slug: "tossa-de-mar",
    name: "Tossa de Mar",
    tagline: "The only walled town on the coast",
    duration: "1 hr 15 min",
    distance: "90 km",
    description: "A twelfth-century fortress standing directly in the sea, with three beaches and the clearest water on the southern Costa Brava.",
    highlights: ["Vila Vella walls", "Platja Gran", "Mar Menuda snorkelling", "Scenic coast road"],
  },
  {
    slug: "salou",
    name: "Salou",
    tagline: "Costa Daurada beaches & PortAventura",
    duration: "1 hr 10 min",
    distance: "100 km",
    description: "The main Costa Daurada resort — long golden beaches, gentle shelving water, and PortAventura World ten minutes inland.",
    highlights: ["Platja de Llevant", "PortAventura World", "Cap Salou coves", "Cambrils nearby"],
  },
  {
    slug: "castelldefels",
    name: "Castelldefels",
    tagline: "The closest beach to the airport",
    duration: "22 min",
    distance: "20 km",
    description: "Five kilometres of wide, flat sand just 20 km from El Prat — the fastest airport-to-beach transfer on this coast.",
    highlights: ["5 km of beach", "22 min from airport", "Medieval castle", "Garraf Natural Park"],
  },
];

export default async function TransfersHubPage() {
  // Prices come from the same table that quotes a booking, so a card can no
  // longer advertise a fare the checkout will not honour.
  const priced = await Promise.all(
    DESTINATIONS.map(async (d) => ({
      ...d,
      price: SLUG_TO_ZONE[d.slug]
        ? (await getDestinationPrices(SLUG_TO_ZONE[d.slug]))?.economy ?? null
        : null,
    })),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(transfersHubSchema) }} />
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
              {priced.map((dest) => (
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
                    <span className="text-gold-400 font-semibold text-lg">
                      {dest.price !== null ? `from €${dest.price}` : "Price on quote"}
                    </span>
                    <span className="text-xs text-dark-500 bg-dark-800 border border-white/[0.06] rounded px-2 py-1">
                      {dest.price !== null ? "Fixed price" : "By distance"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Full A–Z index of every destination page */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-3">
              Every <span className="text-gold-gradient">destination we serve</span>
            </h2>
            <p className="text-dark-400 text-sm text-center mb-10 max-w-2xl mx-auto">
              Fixed-price private transfers to {destinations.length} more hotels, cruise terminals,
              venues and long-distance routes — each with its own prices and journey times.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {TYPE_GROUPS.map(({ type, heading }) => {
                const items = destinations
                  .filter((d) => d.type === type)
                  .sort((a, b) => a.name.localeCompare(b.name));
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="text-white text-xs tracking-[0.2em] uppercase mb-4 font-medium">
                      {heading}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {items.map((d) => (
                        <li key={d.slug}>
                          <Link
                            href={`/transfers/${d.slug}`}
                            className="text-sm text-dark-400 hover:text-gold-400 transition-colors"
                          >
                            {d.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
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
                { icon: Star, label: `${SOCIAL_PROOF.google.rating}★ Rating`, sub: `${SOCIAL_PROOF.google.count} Google reviews` },
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
    </>
  );
}
