import type { Metadata } from "next";
import Link from "next/link";
import {
  Plane, ShieldCheck, CheckCircle2, ChevronRight,
  MessageCircle, Phone, Users, Luggage,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SHARED_OG } from "@/lib/seo";
import { EXTRAS_CATALOG } from "@/types";
import { ROUTES } from "@/lib/pricing";
import { COMPANY } from "@/lib/company-facts";

/**
 * Meet and greet at BCN arrivals.
 *
 * Search Console, twelve months to 24 Aug 2026: 35 impressions across six
 * queries — "book airport meet and greet service barcelona airport" and its
 * variants — at an average position of 62, with no page on the site targeting
 * any of them. The service exists and is sold as a €5 extra in the booking
 * flow; it simply had nowhere to rank.
 *
 * Every figure is read from the extras catalogue and the price table. The point
 * of the page is the distinction people are actually searching for: what the
 * standard pickup already includes, and what the paid extra adds on top. Selling
 * meet and greet by implying the default leaves you stranded would be dishonest
 * and, on a site whose default already includes an hour of free waiting, easy to
 * disprove.
 */

const BASE = "https://www.elitebcn.info";
const URL = `${BASE}/meet-and-greet`;

const meetGreet = EXTRAS_CATALOG.find((e) => e.id === "meet_greet")!;
const nameBoard = EXTRAS_CATALOG.find((e) => e.id === "name_board")!;
const extraWait = EXTRAS_CATALOG.find((e) => e.id === "extra_waiting")!;

/** The cheapest airport fare, so the page can say what the ride itself costs. */
const airportFrom = Math.min(
  ...ROUTES.filter((r) => r.from === "airport").map((r) => r.economy),
);

export const metadata: Metadata = {
  title: { absolute: `Barcelona Airport Meet & Greet Service — ${meetGreet.priceLabel}` },
  description: `Book meet and greet at Barcelona Airport arrivals. Your driver waits inside with a name board and helps with the bags, ${meetGreet.priceLabel} on top of the transfer. 60 minutes free waiting is included either way.`,
  alternates: { canonical: URL },
  keywords: [
    "barcelona airport meet and greet",
    "book airport meet and greet service barcelona airport",
    "meet and greet barcelona airport arrivals",
    "barcelona airport name board pickup",
    "bcn airport greeter service",
  ],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona Airport Meet & Greet — ${meetGreet.priceLabel}`,
    description: `Driver waits inside arrivals with a name board and helps with your luggage. ${meetGreet.priceLabel} added to any Barcelona airport transfer.`,
    url: URL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona Airport meet and greet" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona Airport Meet & Greet — ${meetGreet.priceLabel}`,
    description: `Met inside arrivals with a name board, ${meetGreet.priceLabel} on any transfer.`,
    images: ["/opengraph-image"],
  },
};

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport Meet and Greet",
  description: `Meet and greet at Barcelona El Prat arrivals: the driver waits inside the terminal with a name board and assists with luggage to the vehicle. ${meetGreet.priceLabel} added to any airport transfer. All airport pickups include flight tracking and 60 minutes of free waiting from landing.`,
  url: URL,
  serviceType: "Airport meet and greet",
  provider: { "@id": `${BASE}/#business` },
  areaServed: {
    "@type": "Airport",
    name: "Barcelona El Prat Airport",
    iataCode: "BCN",
  },
  offers: {
    "@type": "Offer",
    price: String(meetGreet.price),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: `${BASE}/book`,
    description: "Optional extra added to any Barcelona airport transfer",
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE },
    { "@type": "ListItem", position: 2, name: "Meet & Greet", item: URL },
  ],
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How much does meet and greet cost at Barcelona Airport?",
    a: `${meetGreet.priceLabel}, added to whatever the transfer itself costs. Airport fares start at €${airportFrom} per vehicle, so a meet and greet arrival into central Barcelona is €${airportFrom + meetGreet.price} in total for an economy car. It is charged once per booking, not per passenger.`,
  },
  {
    q: "What happens if I do not add it?",
    a: "Your driver waits at the designated meeting point just outside the terminal, next to the taxi rank where VTC vehicles are allowed to stop. You still get flight tracking, 60 minutes of free waiting from touchdown, and your driver's name and mobile number in the confirmation so you can call them directly. Nobody is left standing in arrivals wondering — the extra buys convenience, not rescue.",
  },
  {
    q: "Where exactly will the driver be standing?",
    a: "In the arrivals hall of the terminal your flight lands in, past baggage reclaim and customs, holding a board with your name on it. Your booking is tied to your flight number, so we know whether that is T1 or T2 before you do — you never need to move between terminals to find the car.",
  },
  {
    q: "Is a name board the same thing?",
    a: `Not quite, and they are priced separately. Meet and greet at ${meetGreet.priceLabel} is the driver coming inside to find you and helping with the bags. A name board at ${nameBoard.priceLabel} is the printed sign itself. Most people who want to be met inside want both, and you can add either or both when you book.`,
  },
  {
    q: "What if my flight is badly delayed?",
    a: `Nothing you need to do. We track the flight by number and move the pickup to the real landing time at no charge, however long the delay runs. The 60 minutes of free waiting are counted from touchdown rather than from your scheduled arrival. If you need longer than that — a lost bag, a slow queue — extra waiting is ${extraWait.priceLabel}.`,
  },
  {
    q: "Is it worth paying for?",
    a: "Honestly, not always. If you are travelling light and have been through BCN before, the standard pickup outside is quick and costs nothing extra. It earns its price with children, with a lot of luggage, on a first visit, when someone is travelling alone, or when the person arriving would simply rather be walked to the car than read a map.",
  },
];

export default function MeetAndGreetPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />

      <main className="pt-20">
        <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6">
          <ol className="flex items-center gap-2 text-xs text-dark-400">
            <li><Link href="/airport-transfers" className="hover:text-gold-400 transition-colors">Airport Transfers</Link></li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="text-dark-300">Meet &amp; Greet</li>
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
              Barcelona Airport Meet &amp; Greet
            </h1>
            <p className="text-dark-300 text-lg leading-relaxed mb-7">
              Your driver waits <strong className="text-white">inside arrivals</strong> with your
              name on a board and carries the bags to the car.{" "}
              <strong className="text-gold-400">{meetGreet.priceLabel}</strong> added to any airport
              transfer — once per booking, not per passenger.
            </p>

            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: Users, k: "Met inside", v: "Arrivals hall" },
                { icon: Plane, k: "Free waiting", v: "60 minutes" },
                { icon: Luggage, k: "Luggage help", v: "To the car" },
                { icon: ShieldCheck, k: "Extra cost", v: meetGreet.priceLabel },
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
                Book with meet &amp; greet
              </Link>
              <Link href="/airport-transfers" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm">
                See airport fares
              </Link>
            </div>
          </div>
        </section>

        {/* ── With and without ─────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-3">
              What the <span className="text-gold-gradient">{meetGreet.priceLabel} actually buys</span>
            </h2>
            <p className="text-dark-300 mb-8">
              Plenty of operators sell this by implying the alternative is being abandoned at the
              airport. It is not. Here is the honest difference.
            </p>

            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-dark-900">
              <table className="w-full text-sm">
                <caption className="sr-only">Standard airport pickup compared with meet and greet</caption>
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">&nbsp;</th>
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Included as standard</th>
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">With meet &amp; greet</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Where the driver waits", "Designated meeting point outside, by the taxi rank", "Inside the arrivals hall, past baggage reclaim"],
                    ["Name board", "No", "Yes, with your name on it"],
                    ["Luggage", "You bring it out to the car", "Driver takes it from you at the hall"],
                    ["Flight tracking", "Yes", "Yes"],
                    ["Free waiting from landing", "60 minutes", "60 minutes"],
                    ["Driver's direct number", "In your confirmation", "In your confirmation"],
                    ["Cost", "Included in the fare", meetGreet.priceLabel],
                  ].map(([label, std, mg]) => (
                    <tr key={label} className="border-b border-white/[0.04] last:border-0 align-top">
                      <td className="p-3.5 text-white whitespace-nowrap">{label}</td>
                      <td className="p-3.5 text-dark-300">{std}</td>
                      <td className="p-3.5 text-dark-300">{mg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-dark-400 text-sm mt-4">
              The standard pickup is not a lesser service — it is the same car, the same driver and
              the same waiting time, thirty metres further away. If you know BCN and you are
              travelling light, save the {meetGreet.priceLabel}.
            </p>
          </div>
        </section>

        {/* ── When it is worth it ──────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              When it is genuinely <span className="text-gold-gradient">worth paying for</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                <strong className="text-white">Arriving with children.</strong> Getting a family and
                its luggage from baggage reclaim to a car park is the part of the journey nobody
                photographs. Having someone take the heavy end at the door is worth more than
                {" "}{meetGreet.priceLabel} on that particular morning.
              </p>
              <p>
                <strong className="text-white">A first visit, or a long flight.</strong> BCN is a
                straightforward airport, but T2 is split into sections A, B and C and the arrivals
                halls are some distance apart. After eleven hours in the air, being found rather
                than having to find is the point.
              </p>
              <p>
                <strong className="text-white">Someone travelling alone</strong> — an elderly
                parent, a teenager, a colleague arriving in a country whose language they do not
                speak. This is the most common reason people add it, and the one it suits best.
              </p>
              <p>
                <strong className="text-white">Business arrivals where the greeting matters.</strong>{" "}
                A client met by name at the door reads differently from a client sent a car park
                number. The{" "}
                <Link href="/corporate" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">corporate page</Link>{" "}
                covers account billing if this is a regular arrangement.
              </p>
            </div>
          </div>
        </section>

        {/* ── How to add it ────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              How to <span className="text-gold-gradient">add it</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-6">
              Meet and greet is an extra on a transfer rather than a service on its own, so you book
              the journey first and tick the box. It appears in the extras step alongside child
              seats and the name board, and the total updates before you pay.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {[
                `Airport fares start at €${airportFrom} per vehicle`,
                `Meet & greet adds ${meetGreet.priceLabel}, once per booking`,
                "Free cancellation up to 24 hours before",
                "Pay by card, or in cash to the driver",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-dark-300 text-sm bg-dark-900 border border-white/[0.08] rounded-lg p-3.5">
                  <CheckCircle2 size={14} className="text-gold-500 flex-shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
            <p className="text-dark-400 text-sm mt-5">
              Full fares for every route are on the{" "}
              <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">pricing page</Link>,
              and the{" "}
              <Link href="/faq" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">FAQ</Link>{" "}
              covers waiting time and cancellation in detail.
            </p>
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
            <h2 className="font-display text-3xl text-white mb-3">Be met at arrivals</h2>
            <p className="text-dark-300 mb-7">
              {meetGreet.priceLabel} on any Barcelona airport transfer, from €{airportFrom} per vehicle.
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
