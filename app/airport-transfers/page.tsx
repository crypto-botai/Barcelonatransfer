import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Plane, Anchor, Clock, Shield, Star, CheckCircle2, ChevronRight, Luggage, Users } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import HubChildLinks from "@/components/transfers/HubChildLinks";
import { airportChildren } from "@/lib/hub-children";
import { hubItemList } from "@/lib/hub-schema";

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
  title: { absolute: "Private Barcelona Airport Transfer — BCN T1 & T2" },
  // Count and fare read from the price table, like the openGraph block below
  // already did. This sentence said "from €50 to 33 published destinations"
  // while the table held 37 — written when it was true and never revisited.
  description: `Your own car from Barcelona Airport arrivals, never a shared seat. Fixed fares from €${cheapestAirportFare} to ${airportRoutes.length} published destinations across Catalonia and beyond.`,
  alternates: { canonical: "https://www.elitebcn.info/airport-transfers" },
  keywords: ["private barcelona airport transfer", "barcelona airport transfer", "bcn el prat private transfer", "barcelona airport t1 transfer", "barcelona airport t2 transfer"],
  openGraph: {
    ...SHARED_OG,
    title: "Private Barcelona Airport Transfer — BCN T1 & T2 | Elite BCN",
    description: `Private transfer from Barcelona Airport, T1 and T2, from €${airportCityEco} per vehicle. Your car alone, and a published fixed price to ${airportRoutes.length} destinations.`,
    url: "https://www.elitebcn.info/airport-transfers",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona Airport Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Barcelona Airport Transfer — BCN T1 & T2 | Elite BCN",
    description: `Private transfer from Barcelona Airport, T1 and T2, from €${airportCityEco} per vehicle. Your car alone, and a published fixed price to ${airportRoutes.length} destinations.`,
    images: ["/opengraph-image"],
  },
};

const AIRPORT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport Transfer — BCN El Prat",
  serviceType: "Airport Transfer",
  provider: { "@id": "https://www.elitebcn.info/#business" },
  areaServed: { "@type": "Airport", name: "Barcelona El Prat Airport", iataCode: "BCN" },
  description: "Fixed-price private transfers from Barcelona El Prat Airport (T1 & T2). Flight tracking and 60 minutes of free waiting from landing. Meet & greet available as a paid extra.",
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

/**
 * The questions that actually arrive by WhatsApp before a booking.
 *
 * No FAQPage markup: Google retired FAQ rich results for every site on
 * 7 May 2026, so the schema buys nothing, and the answers are more useful as
 * readable prose than as a snippet that no longer renders. Every figure below
 * comes from the price table rather than from memory.
 */
const AIRPORT_FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How much is a transfer from Barcelona Airport?",
    a: `Fares start at €${cheapestAirportFare} per vehicle and are published for ${airportRoutes.length} destinations. The price is per car rather than per person, so a group pays once. The full table is on the pricing page, and every fare there is the fare the checkout charges.`,
  },
  {
    q: "Which terminal will the driver meet me at?",
    a: "The one your flight actually lands in. Your booking is tied to your flight number, so we know the terminal before you do — you do not need to tell us, and you should never take the inter-terminal shuttle to find the car.",
  },
  {
    q: "What happens if my flight is delayed?",
    a: "Nothing you need to do. We track the flight and move the pickup to the real landing time at no charge, however long the delay runs. The 60 minutes of free waiting are measured from touchdown, not from your original scheduled arrival.",
  },
  {
    q: "Is this a shared shuttle?",
    a: "No, and we do not sell one. Every booking is a private vehicle: no other passengers, no pooling, no seat-by-seat pricing and no detours to drop someone else. The car is yours from arrivals to the door.",
  },
  {
    q: "Can I pay the driver in cash?",
    a: "Yes. You can pay by card when you book, or in cash to the driver at the end of the journey. The amount is the same either way, and it is the amount you were quoted.",
  },
  {
    q: "Do you cover destinations outside Barcelona?",
    a: "Yes — the published list runs along both coasts, inland to Montserrat and Girona, and as far as Andorra and Lourdes. Anywhere without a published fare can still be quoted: send the address on WhatsApp and we will price it before you commit.",
  },
];

/**
 * What this hub contains, stated for machines as well as readers.
 * Built from the same derived children the visible links use.
 */
const HUB_LIST = hubItemList({
  name: "Barcelona Airport transfer destinations",
  description: "Every BCN El Prat destination with a published fixed fare and a page of its own.",
  url: "/airport-transfers",
  children: airportChildren(),
});

export default function AirportTransfersPage() {
  return (
    <>
      {HUB_LIST && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HUB_LIST) }} />
      )}
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
              Your driver meets you at the designated meeting point at Terminal 1 or Terminal 2 —
              outside, next to the taxi rank, where reserved VTC cars are permitted to park and wait.
              We track your flight, so an early landing or a two-hour delay changes nothing, and the
              first 60 minutes of waiting are free from the moment you touch down. Prefer to be met
              inside arrivals with a name board? Add meet &amp; greet for €5.
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
            {/* The six cards below are h3. Without a section heading the page
                went h1 straight to h3, which Lighthouse fails as a skipped
                level and which reads to a screen reader as a missing section. */}
            <h2 className="font-display text-3xl text-white text-center mb-10">
              What every airport transfer <span className="text-gold-gradient">includes</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Plane,    title: "Live Flight Tracking",     desc: "We monitor your flight and adjust pickup time automatically. No stress if your flight is early or delayed." },
                { icon: Clock,    title: "60-Min Free Waiting",       desc: "Complimentary 60 minutes waiting time from flight landing. For other pickups, 15 minutes is included." },
                { icon: Shield,   title: "Meet & Greet (€5)",        desc: "Optional add-on: your chauffeur meets you inside the arrivals hall with a name board and helps with your bags. Without it, the driver waits at the designated meeting point outside." },
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
                at €{cheapestAirportFare} for{" "}
                {/* Hub links down to the route page that owns this journey in
                    detail; this page keeps the destination list. */}
                <Link href="/transfers/barcelona-city-centre" className="text-gold-400 hover:text-gold-300">
                  transfers into central Barcelona
                </Link>{" "}
                and reaching along both coasts and into the
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

              <h3 className="font-display text-2xl text-white pt-4">Finding your driver at T1 and T2</h3>
              <p>
                BCN El Prat has two terminals and they are not walkable from one another — a shuttle bus
                runs between them, and it is where most missed pickups begin. Your booking is tied to your
                flight number, so we know which terminal you land in before you do. You do not need to
                tell us, and you should not move terminals to find the car.
              </p>
              <p>
                Terminal 1 handles most full-service and long-haul carriers. Terminal 2 serves most
                low-cost airlines and is split into sections A, B and C, which is worth knowing because
                the arrivals halls are some distance apart. In both, the default is that your driver waits
                at the designated meeting point outside, next to the taxi rank, where VTC cars are
                permitted to stop. Your driver&apos;s name and mobile number are in your confirmation, so
                you can call them directly rather than searching.
              </p>
              <p>
                If you would rather be met inside with a name board — worth it with children, with a lot
                of luggage, or on a first visit — add meet &amp; greet when you book. The driver comes
                through to the arrivals hall and helps with the bags to the car.
              </p>

              <h3 className="font-display text-2xl text-white pt-4">Delays, early landings and waiting time</h3>
              <p>
                Every airport booking is tracked by flight number rather than by the time you typed in.
                If you land forty minutes early the car is already there; if you are delayed by three
                hours, the pickup moves with the flight and there is no rebooking and no surcharge.
              </p>
              <p>
                Airport pickups include 60 minutes of free waiting measured from touchdown, not from your
                scheduled time. That covers passport control and baggage reclaim on all but the worst
                days at the busiest hours. Other pickups — a hotel, an address in town — include 15
                minutes, because there is nothing unpredictable to absorb.
              </p>

              <h3 className="font-display text-2xl text-white pt-4">Choosing the right size of car</h3>
              <p>
                Seats and boot space are separate limits, and on an airport run the boot is almost always
                the one that runs out first. Four adults with four large cases do not fit a saloon,
                whatever the seat count says. Each car on the{" "}
                <Link href="/fleet" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">fleet page</Link>{" "}
                lists what it actually holds, and the{" "}
                <Link href="/tools/transfer-cost-calculator" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">quote tool</Link>{" "}
                will price the alternatives side by side.
              </p>
              <p>
                Child, baby and booster seats are available on request and are fitted before the car
                leaves. Ask for them when you book rather than on the day — they have to be in the
                vehicle that is dispatched.
              </p>

                {/* Saying when we are the wrong choice.

                    A chauffeur car is not the right answer for a solo traveller
                    with one bag, and pretending otherwise costs more credibility
                    than the fare is worth. The metered alternative is a service we
                    also run, so the recommendation is honest about that rather than
                    passing it off as neutral advice. */}
                <h3 className="font-display text-2xl text-white pt-4">When a metered taxi is the better choice</h3>
                <p>
                  A private chauffeur earns its price on a group transfer, an early
                  departure or a route where the boot matters. It does not earn it on a
                  short hop into the city with one case. Barcelona taxi fares are
                  regulated by the AMB, the meter is the same in every licensed cab, and
                  for one or two passengers that is usually the cheaper way to travel.
                </p>
                <p>
                  We run a booking service for exactly that at{" "}
                  <a
                    href="https://bcnairporttaxi.es/en"
                    target="_blank"
                    rel="noopener"
                    className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                  >
                    Taxi Barcelona
                  </a>
                  {" "}— a licensed taxi at the official meter rate, booked ahead so a
                  driver is waiting rather than queuing at the rank. Same people, same
                  standards, different vehicle and a different price.
                </p>
            </div>

            {/* Trust, stated as facts rather than badges. */}
            <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: Plane, t: "Tracked by flight number", d: "The pickup follows the aircraft, not the time you typed in." },
                { icon: Luggage, t: "Priced per vehicle", d: "A family of four pays once, not four times, and the luggage travels with you." },
                { icon: Users, t: "Never a shared seat", d: "No pooling, no other passengers and no detours to drop them." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                  <Icon size={18} className="text-gold-500 mb-3" aria-hidden="true" />
                  <p className="text-white text-sm font-medium mb-1.5">{t}</p>
                  <p className="text-dark-400 text-sm leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs. No FAQPage markup — see the note above AIRPORT_FAQS. */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-8">
              Airport transfer <span className="text-gold-gradient">questions</span>
            </h2>
            <div className="space-y-4">
              {AIRPORT_FAQS.map(({ q, a }) => (
                <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
                  <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                    <h3 className="text-white text-base font-semibold">{q}</h3>
                    <ChevronRight size={18} className="text-gold-500 flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 text-dark-300 text-sm leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* The hub's links down to the pages it covers. It named every airport
            destination in prose and linked to four of them. */}
        <HubChildLinks
          heading="Every airport destination with a page"
          intro="Each of these has its own page with the fixed fare, the journey time and what the run involves. Destinations without a page are still bookable and still priced — the full table is on the pricing page."
          children={airportChildren()}
        />
      </main>
      <Footer />
    </>
  );
}
