import type { Metadata } from "next";
import Link from "next/link";
import {
  Plane, Clock, MapPin, Luggage, ShieldCheck, CreditCard,
  MessageCircle, Phone, CheckCircle2, ChevronRight, Users,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SHARED_OG } from "@/lib/seo";
import { lookupPriceByFleetVehicle } from "@/lib/fixed-prices";
import { VEHICLE_CATALOG, BAG_SIZES, EXTRAS_CATALOG } from "@/types";
import { COMPANY } from "@/lib/company-facts";

/**
 * BCN El Prat ⇄ Barcelona city centre — the route with the most searches and,
 * until now, no page of its own.
 *
 * /airport-transfers is the hub for all 37 airport routes and covers this one
 * in a single table row; the city-centre run had nowhere to land. This owns it.
 * The hub keeps the destination list and links down here, which is the same
 * hub-and-spoke shape /transfers already uses for Sitges and the rest.
 *
 * The comparison section is the part that earns the ranking. The results for
 * this query are held by TMB, barcelona.com and barcelona-tourist-guide — guides,
 * not operators — because people ask what their options are before they book.
 * A page that only sells does not compete with them, so this one answers the
 * question honestly, including the cases where the metro is the better choice.
 *
 * Every figure is read from the price table and the vehicle catalogue. Twenty
 * hotel pages currently quote a fare in hand-written prose that the booking
 * system does not charge; nothing here is typed by hand.
 */

const BASE = "https://www.elitebcn.info";
const URL = `${BASE}/transfers/barcelona-city-centre`;

/** Per-car fares. Camry and Tesla sit below the Business column on this route. */
const FLEET = VEHICLE_CATALOG.map((v) => ({
  ...v,
  price: lookupPriceByFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", v.class),
})).filter((v): v is typeof v & { price: number } => v.price !== null);

const CHEAPEST = Math.min(...FLEET.map((v) => v.price));

/**
 * Distance and journey time.
 *
 * Taken from the twenty Barcelona hotels in data/destinations.json, which carry
 * per-property figures the site already publishes: 12–18 km and 18–26 minutes
 * depending on the district. Quoting a range rather than one number is both
 * honest and more useful — "the city centre" is not one address.
 */
const DISTANCE = "12–18 km";
const DURATION = "18–26 minutes";

const meetGreet = EXTRAS_CATALOG.find((e) => e.id === "meet_greet")!;
const childSeat = EXTRAS_CATALOG.find((e) => e.id === "baby_seat")!;

export const metadata: Metadata = {
  title: { absolute: `Barcelona Airport to City Centre Transfer — from €${CHEAPEST}` },
  description:
    `Private transfer from BCN El Prat T1 or T2 to central Barcelona. Fixed €${CHEAPEST} per vehicle, 60 minutes free waiting from landing, driver meets you in Arrivals.`,
  alternates: { canonical: URL },
  keywords: [
    "barcelona airport to city centre transfer",
    "bcn airport to barcelona",
    "barcelona airport private transfer",
    "el prat to barcelona city",
    "barcelona airport pickup",
  ],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona Airport to City Centre Transfer — from €${CHEAPEST}`,
    description: `Fixed-price private transfer from BCN El Prat T1 and T2 into central Barcelona. ${DISTANCE}, about ${DURATION}. 60 minutes free waiting from landing.`,
    url: URL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona Airport to City Centre Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona Airport to City Centre Transfer — from €${CHEAPEST}`,
    description: `Fixed-price private transfer from BCN El Prat into central Barcelona, from €${CHEAPEST} per vehicle.`,
    images: ["/opengraph-image"],
  },
};

// Provider is a reference to the one business entity the root layout declares.
// Redeclaring it here would give the company a fourth identity, which is the
// fragmentation the 25 Aug schema work removed.
const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport to City Centre Private Transfer",
  description:
    `Fixed-price private transfer between Barcelona El Prat Airport (T1 and T2) and central Barcelona. From €${CHEAPEST} per vehicle, ${DISTANCE}, about ${DURATION}. Flight tracking and 60 minutes of free waiting from landing.`,
  url: URL,
  serviceType: "Airport transfer",
  provider: { "@id": `${BASE}/#business` },
  areaServed: { "@type": "City", name: "Barcelona", sameAs: "https://www.wikidata.org/wiki/Q1492" },
  offers: {
    "@type": "Offer",
    price: String(CHEAPEST),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: `${BASE}/book`,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: CHEAPEST,
      priceCurrency: "EUR",
      unitText: "per vehicle",
    },
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE },
    { "@type": "ListItem", position: 2, name: "Transfers", item: `${BASE}/transfers` },
    { "@type": "ListItem", position: 3, name: "Barcelona City Centre", item: URL },
  ],
};

/**
 * The options a traveller actually has.
 *
 * Public transport figures are the operators' own published fares. The
 * comparison is only worth reading — and only ranks — if it says plainly when
 * the metro or the bus is the better choice, so it does.
 */
const OPTIONS = [
  {
    name: "Private transfer",
    cost: `€${CHEAPEST} per vehicle`,
    time: DURATION,
    best: "Groups, families, luggage, late arrivals, or when you would rather not think about it",
  },
  {
    name: "Aerobús",
    cost: "Per person, tickets from the operator",
    time: "About 35 minutes to Plaça de Catalunya",
    best: "One or two people travelling light to a central stop",
  },
  {
    name: "Metro L9 Sud",
    cost: "Per person, airport supplement applies",
    time: "About 32 minutes, plus a line change for most destinations",
    best: "Solo travellers on a budget with one bag and no stairs to worry about",
  },
  {
    name: "Taxi",
    cost: "Metered, plus an airport supplement",
    time: "Similar to a private transfer, plus the rank queue",
    best: "Arriving off-peak with no wait at the rank",
  },
] as const;

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How much is a transfer from Barcelona Airport to the city centre?",
    a: `From €${CHEAPEST} for the ${FLEET[0].label}, fixed per vehicle rather than per person. Larger cars cost more — the full list is on this page. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.`,
  },
  {
    q: "How long does the journey take?",
    a: `${DISTANCE} depending on where in the city you are going, and ${DURATION} in normal traffic. Allow longer between 8–9am and 5–7pm, and on days with a major event at the Fira or Camp Nou.`,
  },
  {
    q: "Where does the driver meet me at T1 and T2?",
    a: "In the arrivals hall of the terminal your flight lands in, after you have cleared baggage reclaim. Your driver's name and phone number are in your confirmation, so you can reach them directly. A name board is available as an optional extra if you would rather be met with a sign.",
  },
  {
    q: "What happens if my flight is delayed?",
    a: "We track your flight by its number and move the pickup to the actual landing time at no charge. Airport pickups include 60 minutes of free waiting from touchdown, which covers passport control and baggage reclaim on all but the worst days.",
  },
  {
    q: "Can the driver take me to my hotel or apartment?",
    a: "Yes. The fare is door to door to any address inside Barcelona, so a hotel, an apartment or a private address all cost the same. Give the full address when you book and your driver will take you to the door.",
  },
  {
    q: "Is this a private car or a shared shuttle?",
    a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours from arrivals to your destination.",
  },
];

export default function BarcelonaCityCentreTransferPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />

      <main className="pt-20">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6">
          <ol className="flex items-center gap-2 text-xs text-dark-400">
            <li><Link href="/transfers" className="hover:text-gold-400 transition-colors">All Destinations</Link></li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="text-dark-300">Barcelona City Centre</li>
          </ol>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="py-14 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold-500/25 bg-gold-500/[0.05] text-gold-400 text-[11px] tracking-[0.2em] uppercase mb-5">
              <Plane size={12} /> BCN El Prat · T1 &amp; T2
            </span>
            <h1 className="font-display text-4xl sm:text-5xl text-white mb-5 leading-[1.1]">
              Barcelona Airport to City Centre Transfer
            </h1>
            <p className="text-dark-300 text-lg leading-relaxed mb-7">
              A private car from arrivals to your door in central Barcelona.
              Fixed at <strong className="text-gold-400">€{CHEAPEST} per vehicle</strong>, agreed
              before you travel and unchanged by traffic, time of day or how long the queue is.
            </p>

            {/* Facts block — kept terse on purpose: this is the passage an AI
                assistant lifts when asked what the transfer costs. */}
            {/* A list, not a <dl>. Grouping each dt/dd pair in a wrapper div is
                valid HTML5 but axe flags it, and the wrapper is needed for the
                card. A list carries the same meaning without the argument. */}
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: MapPin, k: "Distance", v: DISTANCE },
                { icon: Clock, k: "Journey", v: DURATION },
                { icon: Plane, k: "Free waiting", v: "60 minutes" },
                { icon: ShieldCheck, k: "From", v: `€${CHEAPEST}` },
              ].map(({ icon: Icon, k, v }) => (
                <li key={k} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3">
                  <Icon size={14} className="text-gold-500 mb-1.5" aria-hidden="true" />
                  <span className="block text-dark-400 text-[10px] uppercase tracking-wider">{k}</span>
                  <span className="block text-white text-sm font-medium">{v}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold">
                Book this transfer
              </Link>
              <Link href="/tools/transfer-cost-calculator" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm">
                Get an instant quote
              </Link>
            </div>
          </div>
        </section>

        {/* ── Prices ───────────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-3">
              Fixed prices from BCN Airport to <span className="text-gold-gradient">Barcelona</span>
            </h2>
            <p className="text-dark-300 mb-8">
              Per vehicle, not per person. One passenger and a full car pay the same.
            </p>

            <h3 className="text-white font-semibold mb-4">What each vehicle carries</h3>
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-dark-900">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Fixed fares between Barcelona El Prat Airport and central Barcelona by vehicle
                </caption>
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Vehicle</th>
                    <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Passengers</th>
                    <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Large cases</th>
                    <th scope="col" className="text-right p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Fixed fare</th>
                  </tr>
                </thead>
                <tbody>
                  {FLEET.map((v) => (
                    <tr key={v.class} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-3.5">
                        <span className="text-white">{v.label}</span>
                        {v.badge && <span className="text-dark-400 text-xs ml-2">{v.badge}</span>}
                      </td>
                      <td className="p-3.5 text-center text-dark-300">{v.maxPassengers}</td>
                      <td className="p-3.5 text-center text-dark-300">{v.largeBags}</td>
                      <td className="p-3.5 text-right text-gold-400 font-semibold">€{v.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-400 text-xs mt-3">
              Large case = {BAG_SIZES.large.cm}. Seats and boot space are separate limits — the
              boot is usually the one that bites.
            </p>

            <h3 className="text-white font-semibold mt-10 mb-4">What the fare includes — and what it doesn&apos;t</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <p className="text-white text-sm font-medium mb-3">Included</p>
                <ul className="space-y-2">
                  {[
                    "Licensed chauffeur, vehicle and fuel",
                    "Flight tracking, pickup moved to your landing time",
                    "60 minutes free waiting from touchdown",
                    "Parking and airport access fees",
                    "Free cancellation up to 24 hours before",
                  ].map((t) => (
                    <li key={t} className="flex gap-2 text-dark-300 text-sm">
                      <CheckCircle2 size={14} className="text-gold-500 flex-shrink-0 mt-0.5" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <p className="text-white text-sm font-medium mb-3">Charged separately</p>
                <ul className="space-y-2 text-dark-300 text-sm">
                  <li>10% VAT — only if you request an invoice</li>
                  <li>Motorway tolls, on routes that use them</li>
                  <li>{meetGreet.label} with a name board — {meetGreet.priceLabel}</li>
                  <li>Child, baby and booster seats — {childSeat.priceLabel}</li>
                </ul>
                <p className="text-dark-400 text-xs mt-3">
                  See the <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">full fixed-price list</Link> for
                  every route we publish.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison ───────────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-3">
              Getting into the city: every option <span className="text-gold-gradient">compared</span>
            </h2>
            <p className="text-dark-300 mb-8">
              A private car is not always the right answer. Here is what each option actually
              suits, so you can decide before you land.
            </p>

            <div className="space-y-4">
              {OPTIONS.map((o) => (
                <div key={o.name} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <h3 className="text-white font-semibold">{o.name}</h3>
                    <span className="text-gold-400 text-sm">{o.cost}</span>
                  </div>
                  <p className="text-dark-400 text-sm mb-2">{o.time}</p>
                  <p className="text-dark-300 text-sm"><span className="text-dark-400">Best for:</span> {o.best}</p>
                </div>
              ))}
            </div>

            <h3 className="text-white font-semibold mt-10 mb-3">Which one suits you</h3>
            <p className="text-dark-300 leading-relaxed mb-4">
              If you are one or two people with hand luggage and your hotel is near a metro stop,
              the L9 or the Aerobús will get you there perfectly well and cost a fraction of a
              private car. We would rather tell you that than sell you a transfer you did not need.
            </p>
            <p className="text-dark-300 leading-relaxed">
              A private transfer earns its price in the cases public transport handles badly: four
              people with four suitcases, a late-night landing when services thin out, small
              children, an early departure with a fixed check-in, or an address that is a walk and
              a line change from the nearest station. Split between four, €{CHEAPEST} for the car
              is close to four Aerobús fares — and it goes to your door.
            </p>

            <p className="text-dark-300 leading-relaxed">
              If you would rather take an official Barcelona taxi &mdash; the black-and-yellow
              cabs on the AMB meter &mdash; you can book one before you land at{" "}
              <a
                href="https://bcnairporttaxi.es/en"
                target="_blank"
                rel="noopener"
                className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40"
              >
                Barcelona Airport Taxi
              </a>
              , a separate site we also run. It is a different service to this one: a metered
              fare rather than a price fixed in advance, and a licensed city taxi rather than a
              private chauffeur. For one or two people going a short distance into the centre it
              is often the cheaper of the two.
            </p>

            <div className="mt-8">
              <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold">
                Book a private transfer
              </Link>
            </div>
          </div>
        </section>

        {/* ── Meeting point ────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Where your driver <span className="text-gold-gradient">meets you</span>
            </h2>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-2">Terminal 1 arrivals</h3>
                <p className="text-dark-300 text-sm leading-relaxed">
                  T1 handles most long-haul and full-service airlines. Your driver waits in the
                  arrivals hall once you have cleared baggage reclaim, and their name and number
                  are in your confirmation so you can call them directly.
                </p>
              </div>
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-2">Terminal 2 arrivals</h3>
                <p className="text-dark-300 text-sm leading-relaxed">
                  T2 serves most low-cost carriers and is split into sections A, B and C. Tell us
                  your flight number and we will meet you at the right one — the terminals are a
                  free shuttle ride apart, and you should not need to make it.
                </p>
              </div>
            </div>

            <h3 className="text-white font-semibold mb-3">If your flight is delayed</h3>
            <p className="text-dark-300 leading-relaxed mb-4">
              We track your flight by its number, so a delay moves your pickup rather than costing
              you the booking, and an early landing is met early. The 60 minutes of free waiting
              are counted from when the wheels touch down, not from the time you booked — which
              covers passport control and baggage reclaim on all but the worst days at El Prat.
            </p>
            <p className="text-dark-300 leading-relaxed">
              If anything changes while you are travelling, the fastest way to reach us is{" "}
              <a href={COMPANY.whatsapp} target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                WhatsApp
              </a>, answered around the clock.
            </p>
          </div>
        </section>

        {/* ── The journey ──────────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              The journey into <span className="text-gold-gradient">Barcelona</span>
            </h2>

            <h3 className="text-white font-semibold mb-3">Distance and typical time</h3>
            <p className="text-dark-300 leading-relaxed mb-6">
              El Prat sits southwest of the city. Depending on which district you are heading for,
              the drive is {DISTANCE} and takes {DURATION} in normal traffic — the Diagonal end of
              town is the quickest, the Eixample and Gràcia the slowest. The route runs along the
              C-32 and the Ronda Litoral for most destinations.
            </p>

            <h3 className="text-white font-semibold mb-3">Rush hour and event days</h3>
            <p className="text-dark-300 leading-relaxed">
              Allow extra time between roughly 8–9am and 5–7pm on weekdays, and on days with a
              major congress at the Fira or a match at Camp Nou, when the Ronda backs up. Your
              fare does not change: the price is fixed per vehicle whatever the traffic does,
              which is the practical difference between a fixed transfer and a meter.
            </p>
          </div>
        </section>

        {/* ── Luggage ──────────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Choosing a vehicle for your <span className="text-gold-gradient">luggage</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-5">
              Seats and boot space are separate limits, and the boot is usually the one that
              catches people out. The {FLEET[2].label} seats {FLEET[2].maxPassengers} but takes{" "}
              {FLEET[2].largeBags} large cases; the {FLEET[4].label} seats {FLEET[4].maxPassengers}{" "}
              and takes {FLEET[4].largeBags}. Four people flying home with a large case each need
              the boot, not the seats.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/fleet" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm">
                <Users size={14} /> Compare the whole fleet
              </Link>
              <Link href="/fleet/luxury-minivan" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm">
                <Luggage size={14} /> Room for families and groups
              </Link>
            </div>
          </div>
        </section>

        {/* ── Hotels & onward ──────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Hotel and apartment <span className="text-gold-gradient">drop-off</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-4">
              The fare is door to door to any address inside Barcelona, so a hotel on Passeig de
              Gràcia, an apartment in Poblenou and a private address all cost the same. Give the
              full address when you book — including the door number — and your driver takes you
              there rather than to the nearest corner.
            </p>
            <p className="text-dark-300 leading-relaxed">
              We publish{" "}
              <Link href="/hotel-transfers" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                pickup details for Barcelona hotels
              </Link>{" "}
              and run the same fixed-price service to{" "}
              <Link href="/transfers/cruise-port" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                the cruise terminals at Moll Adossat
              </Link>{" "}
              if you are connecting to a ship. Every other route we cover is on the{" "}
              <Link href="/transfers" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">destinations page</Link>.
            </p>
          </div>
        </section>

        {/* ── Booking ──────────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Booking, payment and <span className="text-gold-gradient">cancellation</span>
            </h2>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: CheckCircle2, t: "Booking", b: "About two minutes online, confirmed immediately by email and WhatsApp. Your driver's details arrive before the day." },
                { icon: CreditCard, t: "Payment", b: "Card online at booking, bank transfer, or cash on arrival. No deposit for standard bookings." },
                { icon: ShieldCheck, t: "Cancellation", b: "Free more than 24 hours before pickup. Within 24 hours, 50%. Refunds land in five to seven working days." },
              ].map(({ icon: Icon, t, b }) => (
                <div key={t} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                  <Icon size={18} className="text-gold-500 mb-2.5" />
                  <h3 className="text-white font-semibold mb-1.5">{t}</h3>
                  <p className="text-dark-300 text-sm leading-relaxed">{b}</p>
                </div>
              ))}
            </div>

            {/* Trust, stated as facts rather than badges. */}
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
              <p className="text-dark-300 text-sm leading-relaxed">
                Elite BCN has operated in Barcelona since {COMPANY.foundedYear} under a Spanish VTC
                licence — the permit required to carry passengers by private hire, which is why we
                can quote a fixed fare weeks ahead and hold it. Every journey is private: we never
                combine bookings or sell seats individually. Questions before you book go to{" "}
                <a href={COMPANY.whatsapp} target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">WhatsApp</a>{" "}
                or <a href={`tel:${COMPANY.phone}`} className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">{COMPANY.phoneDisplay}</a>,
                answered 24 hours a day.
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQs ─────────────────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-8">
              Common <span className="text-gold-gradient">questions</span>
            </h2>
            <div className="space-y-4">
              {FAQS.map(({ q, a }) => (
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

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <h2 className="font-display text-3xl text-white mb-3">
              Book your airport transfer
            </h2>
            <p className="text-dark-300 mb-7">
              Fixed at €{CHEAPEST} per vehicle from BCN El Prat into central Barcelona.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold">
                Book now
              </Link>
              <a href={COMPANY.whatsapp} target="_blank" rel="noreferrer" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-4 rounded-xl text-sm">
                <MessageCircle size={14} /> Ask on WhatsApp
              </a>
              <a href={`tel:${COMPANY.phone}`} className="btn-outline-gold inline-flex items-center gap-2 px-6 py-4 rounded-xl text-sm">
                <Phone size={14} /> {COMPANY.phoneDisplay}
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
