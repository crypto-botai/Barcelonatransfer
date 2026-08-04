import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, ChevronRight, CheckCircle2 } from "lucide-react";
import { ROUTES as PRICING_ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

const BASE = "https://www.elitebcn.info";

// Base airport→city Economy price from the single source of truth
const airportCityPrice = PRICING_ROUTES.find(
  (r) => r.from === "airport" && r.to === "barcelona_city"
)?.economy ?? 45;

export const metadata: Metadata = {
  title: { absolute: "Hotel Transfers Barcelona — Airport to Hotel | Élite BCN" },
  description:
    `Private hotel transfers in Barcelona from €${airportCityPrice}. Airport to hotel, hotel to cruise port. Meet & greet, flight tracking, free waiting. All 5-star hotels covered.`,
  alternates: { canonical: `${BASE}/hotel-transfers` },
  keywords: ["hotel transfer barcelona", "airport hotel transfer barcelona", "barcelona hotel chauffeur"],
  openGraph: {
    ...SHARED_OG,
    title: "Hotel Transfers Barcelona — Élite BCN Private Chauffeur",
    description:
      "Private transfers between Barcelona Airport and all major hotels. Fixed price, flight tracking, meet & greet.",
    url: `${BASE}/hotel-transfers`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Élite BCN — Hotel Transfer Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hotel Transfers Barcelona — Élite BCN",
    description: `Private airport to hotel transfers in Barcelona from €${airportCityPrice}. Fixed price, flight tracking, meet & greet.`,
    images: [`${BASE}/opengraph-image`],
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",            item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Hotel Transfers", item: "https://www.elitebcn.info/hotel-transfers" },
  ],
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Hotel Transfers Barcelona",
  serviceType: "Airport Hotel Transfer",
  provider: { "@type": "Organization", name: "Élite BCN Transfers", url: BASE },
  areaServed: { "@type": "City", name: "Barcelona" },
  description:
    "Private luxury transfers between Barcelona Airport and all major Barcelona hotels. Fixed prices, flight monitoring, free 60-minute wait.",
  url: `${BASE}/hotel-transfers`,
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "50",
    highPrice: "150",
    priceCurrency: "EUR",
  },
};

const HOTEL_ROUTES = [
  { from: "BCN Airport", to: "Hotels — Eixample, Gràcia",                    price: `€${airportCityPrice}`, duration: "20–25 min" },
  { from: "BCN Airport", to: "Hotels — Barceloneta / Port",                   price: `€${airportCityPrice}`, duration: "20–30 min" },
  { from: "BCN Airport", to: "Hotels — Diagonal Mar / Forum",                 price: `€${airportCityPrice + 5}`, duration: "25–30 min" },
  { from: "BCN Airport", to: "W Barcelona, Hotel Arts",                       price: `€${airportCityPrice}`, duration: "20–25 min" },
  { from: "BCN Airport", to: "Mandarin Oriental, El Palace, Majestic",        price: `€${airportCityPrice}`, duration: "20 min" },
  { from: "Hotel",       to: "Cruise Port (Terminals A–F)",                   price: `€${airportCityPrice}`, duration: "15–25 min" },
  { from: "Hotel",       to: "Hotel (any area)",                              price: "from €35",              duration: "Varies" },
  { from: "Hotel",       to: "Train station (Sants, Passeig de Gràcia)",      price: "from €35",              duration: "10–20 min" },
];

const HOTELS = [
  "W Barcelona", "Hotel Arts Barcelona", "Mandarin Oriental Barcelona",
  "Hotel El Palace", "Majestic Hotel & Spa", "Cotton House Hotel",
  "Ohla Barcelona", "Grand Hyatt Barcelona", "Four Seasons Barcelona",
  "Fairmont Rey Juan Carlos", "Hilton Diagonal Mar", "Sofia Hotel Barcelona",
  "Almanac Barcelona", "The Serras Hotel", "Hotel 1898",
];

export default function HotelTransfersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-24 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,168,76,0.09),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
            <div className="flex justify-center items-center gap-2 mb-6 text-sm text-dark-400">
              <Link href="/" className="hover:text-gold-400 transition-colors">Home</Link>
              <ChevronRight size={14} className="text-dark-600" />
              <span className="text-gold-400">Hotel Transfers</span>
            </div>
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
              Fixed Price · Flight Tracked · Meet & Greet
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6 leading-tight">
              Hotel Transfers <br />
              <span className="text-gold-gradient">Barcelona</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-xl mx-auto mb-10">
              Private luxury transfers between Barcelona Airport and every major hotel in the city.
              From €{airportCityPrice} — fixed price, no meter, no surge.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-dark-300 mb-10">
              <span className="flex items-center gap-2"><Star size={14} className="text-gold-500" /> Fixed price from €{airportCityPrice}</span>
              <span className="flex items-center gap-2"><Shield size={14} className="text-gold-500" /> 60 min free waiting</span>
              <span className="flex items-center gap-2"><Clock size={14} className="text-gold-500" /> Flight monitoring included</span>
            </div>
            <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
              Book Hotel Transfer <ChevronRight size={15} />
            </Link>
          </div>
        </section>

        {/* Price table */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Hotel Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-2xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">From</th>
                    <th className="text-left text-dark-400 font-medium p-4">To</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                    <th className="text-right text-dark-400 font-medium p-4 hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {HOTEL_ROUTES.map((r) => (
                    <tr key={`${r.from}-${r.to}`} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-dark-300">{r.from}</td>
                      <td className="p-4 text-white">{r.to}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{r.price}</td>
                      <td className="p-4 text-dark-500 text-right hidden sm:table-cell">{r.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center">
              Prices shown for sedan (1–3 pax). MPV/minivan available for larger groups. Prices exclude VAT and tolls; meet & greet and 60 min free waiting are included.
            </p>
          </div>
        </section>

        {/* What's included */}
        <section className="py-20 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              What&apos;s <span className="text-gold-gradient">Included</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "Name board in arrivals hall",
                "Real-time flight tracking",
                "60 minutes free waiting (airport)",
                "15 minutes free waiting (hotels)",
                "Meet & greet at arrivals",
                "Bottled water on board",
                "WiFi available on request",
                "Child seats available free",
                "Assistance with luggage",
                "Confirmation email & WhatsApp",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-dark-300">
                  <CheckCircle2 size={16} className="text-gold-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Hotels we serve */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white text-center mb-4">
              Hotels We <span className="text-gold-gradient">Serve</span>
            </h2>
            <p className="text-dark-400 text-center mb-10">
              We transfer to all Barcelona hotels. Here are some of our most popular 5-star properties:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {HOTELS.map((hotel) => (
                <span
                  key={hotel}
                  className="text-sm px-4 py-2 rounded-full border border-white/[0.08] bg-dark-900 text-dark-300 hover:border-gold-500/20 hover:text-gold-400 transition-colors"
                >
                  {hotel}
                </span>
              ))}
            </div>
            <p className="text-center mt-6">
              <Link href="/transfers" className="text-gold-500 hover:text-gold-400 text-sm inline-flex items-center gap-1">
                View all destination pages <ChevronRight size={12} />
              </Link>
            </p>
          </div>
        </section>

        {/* How to book */}
        <section className="py-20 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              How to <span className="text-gold-gradient">Book</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {[
                { step: "1", title: "Enter your route", body: "Type your hotel name or address. Our system supports all Barcelona hotels." },
                { step: "2", title: "Choose your vehicle", body: "Sedan (1–3 pax), Minivan (4–6), V-Class (7+). All vehicles fully equipped." },
                { step: "3", title: "Instant confirmation", body: "Receive your booking confirmation immediately by email and WhatsApp." },
              ].map(({ step, title, body }) => (
                <div key={step}>
                  <div className="w-12 h-12 rounded-full border border-gold-500/40 flex items-center justify-center text-gold-400 font-display text-xl mx-auto mb-4">
                    {step}
                  </div>
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">
                Book Your Hotel Transfer
              </Link>
            </div>
          </div>
        </section>

        {/* Internal links */}
        <section className="py-12 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="text-dark-500 text-xs text-center mb-4">Related services</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/airport-transfers" className="text-dark-400 hover:text-gold-400 transition-colors">Airport Transfers</Link>
              <Link href="/transfers/cruise-port" className="text-dark-400 hover:text-gold-400 transition-colors">Cruise Port Transfers</Link>
              <Link href="/corporate" className="text-dark-400 hover:text-gold-400 transition-colors">Corporate Travel</Link>
              <Link href="/vip-transportation" className="text-dark-400 hover:text-gold-400 transition-colors">VIP Transportation</Link>
              <MapPin size={12} className="text-dark-600 self-center" />
              <Link href="/pricing" className="text-dark-400 hover:text-gold-400 transition-colors">Full Price List</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
