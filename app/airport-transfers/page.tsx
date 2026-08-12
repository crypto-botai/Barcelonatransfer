import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Plane, Anchor, Clock, Shield, Star, CheckCircle2 } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

const airportCityEco = ROUTES.find((r) => r.from === "airport" && r.to === "barcelona_city")?.economy ?? 45;

// Coverage figures come from the price table rather than from prose, so the
// page cannot claim a destination count or a starting fare the booking would
// not honour.
const airportRoutes = ROUTES.filter((r) => r.from === "airport");
const cheapestAirportFare = Math.min(...airportRoutes.map((r) => r.economy));

/**
 * Owns the private airport transfer intent, as the service page for it.
 *
 * The homepage remains the brand root and carries the broader term by
 * performance — 812 impressions at position 14.4 against this page's 79 at
 * 38.8. The two are kept apart by qualifier rather than by topic: this page
 * leads on "private", on the terminals, and on where the car actually goes
 * afterwards, which is the part the homepage does not cover.
 */
export const metadata: Metadata = {
  title: { absolute: "Private Barcelona Airport Transfer — BCN T1 & T2 | Élite BCN" },
  description: `Private transfer from Barcelona Airport, Terminal 1 and Terminal 2, from €${airportCityEco} per vehicle. Your car alone, no shared seats, and a published fixed price to ${airportRoutes.length} destinations.`,
  alternates: { canonical: "https://www.elitebcn.info/airport-transfers" },
  keywords: ["private barcelona airport transfer", "barcelona airport transfer", "bcn el prat private transfer", "barcelona airport t1 transfer", "barcelona airport t2 transfer"],
  openGraph: {
    ...SHARED_OG,
    title: "Private Barcelona Airport Transfer — BCN T1 & T2 | Élite BCN",
    description: `Private transfer from Barcelona Airport, T1 and T2, from €${airportCityEco} per vehicle. Your car alone, and a published fixed price to ${airportRoutes.length} destinations.`,
    url: "https://www.elitebcn.info/airport-transfers",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona Airport Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Barcelona Airport Transfer — BCN T1 & T2 | Élite BCN",
    description: `Private transfer from Barcelona Airport, T1 and T2, from €${airportCityEco} per vehicle. Your car alone, and a published fixed price to ${airportRoutes.length} destinations.`,
    images: ["/opengraph-image"],
  },
};

const AIRPORT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport Transfer — BCN El Prat",
  serviceType: "Airport Transfer",
  provider: { "@type": "Organization", name: "Élite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: { "@type": "Airport", name: "Barcelona El Prat Airport", iataCode: "BCN" },
  description: "Fixed-price luxury private transfers from Barcelona El Prat Airport (T1 & T2). Meet & greet, flight tracking, 60 min free waiting.",
  url: "https://www.elitebcn.info/airport-transfers",
  offers: { "@type": "Offer", price: `${airportCityEco}`, priceCurrency: "EUR", priceValidUntil: "2027-12-31" },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",              item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Airport Transfers", item: "https://www.elitebcn.info/airport-transfers" },
    ],
  },
};

export default function AirportTransfersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(AIRPORT_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <Plane size={12} /> Private Airport Transfer
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Private Barcelona <br /><span className="text-gold-gradient">Airport Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Your driver waits inside the arrivals hall at Terminal 1 or Terminal 2, name board in hand,
              and walks you to the car. We track your flight, so an early landing or a two-hour delay
              changes nothing — the first 60 minutes of waiting are free from the moment you touch down.
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
                  {ROUTES.filter((r) =>
                    (r.from === "airport" && r.to === "barcelona_city") ||
                    (r.from === "airport" && r.to === "cruise") ||
                    (r.from === "cruise"  && r.to === "barcelona_city") ||
                    (r.from === "airport" && r.to === "sants") ||
                    (r.from === "barcelona_city" && r.to === "girona_airport")
                  ).map((r) => (
                    <tr key={r.label} className="price-row border-b border-white/[0.04]">
                      <td className="py-4 px-5 text-sm text-dark-200">{r.label}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-gold-400 font-semibold">€{r.economy}</span>
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

            {/* Coverage read from the price table itself. Nothing here is typed
                by hand: the count and the cheapest fare come from the same
                source the booking quotes from, so the page cannot drift. */}
            <div className="max-w-3xl mx-auto mt-14 space-y-4 text-dark-300 leading-relaxed">
              <h3 className="font-display text-2xl text-white">Where we go from the airport</h3>
              <p>
                {airportRoutes.length} destinations have a published fixed price from BCN El Prat, starting
                at €{cheapestAirportFare} for the city centre and reaching along both coasts and into the
                Pyrenees. The price is per vehicle and set before you travel, so it does not move with
                traffic, with the hour, or with how long the queue at passport control turns out to be.
              </p>
              <p>
                The busiest are{" "}
                <Link href="/transfers/sitges" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">Sitges</Link>,{" "}
                <Link href="/transfers/cruise-port" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">the cruise terminal</Link>,{" "}
                <Link href="/transfers/costa-brava" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">the Costa Brava</Link>{" "}
                and{" "}
                <Link href="/transfers/andorra" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">Andorra</Link>,
                which is the longest of the regular runs. The{" "}
                <Link href="/transfers" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">full destination list</Link>{" "}
                carries a price for each.
              </p>

              <h3 className="font-display text-2xl text-white pt-4">A private car, not a shared seat</h3>
              <p>
                Every booking is a private transfer. The vehicle is yours for the journey — no other
                passengers, no other stops, and no per-seat pricing. A family of four pays the vehicle
                price once rather than four times, and the luggage goes in the car you booked.
              </p>
              <p>
                That also means the departure is yours. There is no published timetable to catch: the
                driver is there for your flight, and if the arrival slips the pickup moves with it.
              </p>

              <h3 className="font-display text-2xl text-white pt-4">What the fare covers</h3>
              <p>
                The fixed price covers the chauffeur, the vehicle and fuel. VAT is added only if you ask
                for an invoice, and motorway tolls are charged separately on the routes that use them —
                which mostly means the longer runs south and north rather than the short hop into the city.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
