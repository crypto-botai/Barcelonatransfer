import type { Metadata } from "next";
import Link from "next/link";
import {
  Snowflake, Clock, MapPin, ShieldCheck, CheckCircle2, ChevronRight,
  MessageCircle, Phone, Mountain, Luggage,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";
import { COMPANY } from "@/lib/company-facts";

/**
 * The Andorra ski stations, which are the one Andorran destination group that is
 * not fixed-price.
 *
 * Search Console, twelve months to 24 Aug 2026: Pas de la Casa 23 impressions at
 * position 48, Soldeu 10 at 45, Arinsal 7 at 54, Grandvalira 6 at 15, plus
 * "barcelona to la seu d'urgell and andorra transfer" at 25. Every one is
 * booking intent and none had a page. Around seventy impressions between them.
 *
 * One page rather than four. Individually these are single-digit clusters, and
 * four near-identical resort pages is precisely the thin-duplicate pattern that
 * makes a site look manufactured — the quality gate on location pages asks for
 * 60% unique content, which four pages about four villages on one mountain
 * cannot honestly meet. They share a road, a season and a price rule, so they
 * share a page.
 *
 * NO FARE IS PRINTED HERE, and that is deliberate. lib/pricing.ts classes these
 * as ski stations and prices them by road distance rather than at the Andorra
 * fare; the live quote engine returns €491 for Pas de la Casa and €505 for
 * Soldeu against Andorra's fixed €300. A single number on this page would be
 * wrong for most readers, and the last time these were advertised at a flat
 * figure it was €240 — less than half. The page sends people to the quote tool
 * instead, which is the only thing that knows.
 */

const BASE = "https://www.elitebcn.info";
const URL = `${BASE}/transfers/andorra-ski-resorts`;

/** The fixed Andorra fare, quoted only as the contrast it actually is. */
const ANDORRA = ladderFor("andorra", "airport");

export const metadata: Metadata = {
  title: { absolute: "Barcelona Airport to Andorra Ski Resorts Transfer" },
  description:
    "Private transfers from BCN El Prat to Grandvalira, Pas de la Casa, Soldeu and Arinsal. Priced by road distance and quoted before you book. Skis and boards carried free.",
  alternates: { canonical: URL },
  keywords: [
    "barcelona to pas de la casa transfer",
    "barcelona to soldeu transfer",
    "barcelona to grandvalira transfer",
    "barcelona to arinsal transfer",
    "andorra ski resort airport transfer",
  ],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Airport to Andorra Ski Resorts Transfer",
    description:
      "Private transfer from BCN El Prat to Grandvalira, Pas de la Casa, Soldeu and Arinsal. Quoted by road distance, skis carried free, flight tracked.",
    url: URL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Andorra ski resort transfers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Airport to Andorra Ski Resorts Transfer",
    description: "Private transfers to Grandvalira, Pas de la Casa, Soldeu and Arinsal. Quoted by road distance.",
    images: ["/opengraph-image"],
  },
};

// provider references the single business entity the root layout declares.
// No offers block: these journeys have no fixed price to publish, and inventing
// one is the failure this page exists to avoid.
const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Andorra Ski Resort Private Transfer",
  description:
    "Private transfer from Barcelona El Prat Airport to the Andorran ski stations — Grandvalira, Pas de la Casa, Soldeu, El Tarter, Arinsal and Vallnord. Priced by road distance and quoted before booking. Ski and snowboard carriage included.",
  url: URL,
  serviceType: "Ski resort transfer",
  provider: { "@id": `${BASE}/#business` },
  areaServed: {
    "@type": "Place",
    name: "Grandvalira",
    sameAs: "https://www.wikidata.org/wiki/Q1918034",
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE },
    { "@type": "ListItem", position: 2, name: "Transfers", item: `${BASE}/transfers` },
    { "@type": "ListItem", position: 3, name: "Andorra Ski Resorts", item: URL },
  ],
};

/**
 * Journey times are stated as ranges from the Andorra page's published ~3 hours
 * to Andorra la Vella, plus the climb to each station. No distance is claimed
 * per resort: the quote engine measures the real road distance at booking, and
 * that is the number that decides the fare.
 */
const RESORTS = [
  {
    name: "Grandvalira",
    area: "Encamp · Canillo · Soldeu · El Tarter · Pas de la Casa",
    note: "The largest ski area in the Pyrenees, spread across the eastern valleys. Which sector you are staying in changes the drive by up to forty minutes, so the quote is per address rather than per resort.",
  },
  {
    name: "Pas de la Casa",
    area: "French border, top of the CG-2",
    note: "The highest and furthest of the Andorran bases, right on the border. The last stretch is mountain road above the tree line, and in a heavy season it is the one most likely to add time.",
  },
  {
    name: "Soldeu · El Tarter",
    area: "Mid-valley, Canillo parish",
    note: "Closer to Andorra la Vella than Pas de la Casa and a shorter final climb. A common choice for families who want the Grandvalira lift network without the border-side altitude.",
  },
  {
    name: "Arinsal · Pal · Vallnord",
    area: "Western valleys, La Massana",
    note: "The other side of the country from Grandvalira, reached through La Massana rather than up the CG-2. Different road, similar drive, and worth saying when you book because the routes diverge early.",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How much is a transfer from Barcelona Airport to the ski resorts?",
    a: "It depends on the station, and we quote it before you book rather than printing one figure here. The resorts sit at different distances up different valleys, and a single number would be wrong for most people reading it. Put your exact destination into the quote tool and you will get the real price in a few seconds.",
  },
  {
    q: "Why is this not a fixed price like Andorra la Vella?",
    a: `Andorra la Vella and the valley towns take a fixed fare — €${ANDORRA?.economy ?? "—"} for an economy sedan — because they are all roughly the same drive. The ski stations are not: they are higher, further and reached by different roads, so they are priced on the road distance actually covered. That is why the quote asks for your exact address.`,
  },
  {
    q: "Can you carry skis, boards and boot bags?",
    a: "Yes, at no extra charge. Tell us how many sets when you book so the right vehicle is sent. Ski bags take boot space rather than seats — four passengers with four sets of kit need a larger car than four passengers with suitcases, and that is the single most common sizing mistake on this route.",
  },
  {
    q: "How long does it take from the airport?",
    a: "Roughly three hours to the Andorran valley towns, plus the climb to your station — so allow three and a half to four hours to the higher resorts in good conditions. In snow it takes longer, and a fixed quote means that costs you time rather than money.",
  },
  {
    q: "What if my flight lands late in the evening?",
    a: "The car still comes. We track the flight by number and move the pickup to the actual landing time, which matters more on this route than most: the scheduled coaches stop early and there is no train to Andorra at all. Airport pickups include 60 minutes of free waiting from touchdown.",
  },
  {
    q: "Do you cross into France or Spain on the way?",
    a: "The route runs through Spain and enters Andorra at the southern border post. Pas de la Casa sits on the French frontier at the far end of the CG-2, but the drive from Barcelona reaches it from the Andorran side — you do not enter France. Bring passports or ID cards: Andorra is not in the EU and there is a border check.",
  },
];

export default function AndorraSkiResortsPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />

      <main className="pt-20">
        <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6">
          <ol className="flex items-center gap-2 text-xs text-dark-400">
            <li><Link href="/transfers" className="hover:text-gold-400 transition-colors">All Destinations</Link></li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="text-dark-300">Andorra Ski Resorts</li>
          </ol>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="py-14 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold-500/25 bg-gold-500/[0.05] text-gold-400 text-[11px] tracking-[0.2em] uppercase mb-5">
              <Snowflake size={12} /> Grandvalira · Vallnord
            </span>
            <h1 className="font-display text-4xl sm:text-5xl text-white mb-5 leading-[1.1]">
              Barcelona Airport to Andorra Ski Resorts
            </h1>
            <p className="text-dark-300 text-lg leading-relaxed mb-7">
              A private car from arrivals to the snow, with your skis in the back and no
              change of vehicle on the way. Priced on the road distance to your actual
              address and <strong className="text-gold-400">quoted before you book</strong> —
              never a guess printed on a page.
            </p>

            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: Clock, k: "Journey", v: "3–4 hours" },
                { icon: Snowflake, k: "Ski carriage", v: "Included" },
                { icon: MapPin, k: "Price", v: "By distance" },
                { icon: ShieldCheck, k: "Free waiting", v: "60 minutes" },
              ].map(({ icon: Icon, k, v }) => (
                <li key={k} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3">
                  <Icon size={14} className="text-gold-500 mb-1.5" aria-hidden="true" />
                  <span className="block text-dark-400 text-[10px] uppercase tracking-wider">{k}</span>
                  <span className="block text-white text-sm font-medium">{v}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Link href="/tools/transfer-cost-calculator" className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold">
                Get your resort price
              </Link>
              <Link href="/book" className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm">
                Book a transfer
              </Link>
            </div>
          </div>
        </section>

        {/* ── Why no fixed price ───────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Why there is no single <span className="text-gold-gradient">price on this page</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Every other destination on this site carries a fixed fare, agreed before you
                travel. The ski stations are the one exception, and it is worth explaining why
                rather than leaving you to wonder.
              </p>
              <p>
                Andorra la Vella, Encamp and the valley towns are all about the same drive from
                Barcelona, so they share one price
                {ANDORRA ? <> — <strong className="text-white">€{ANDORRA.economy}</strong> for an economy sedan</> : null}.
                The stations are not: they sit higher, further and up different valleys, and the
                difference between them is real money rather than a rounding error.
              </p>
              <p>
                Printing one figure would therefore be wrong for most people reading it. It has
                been done before on this site, at a flat rate that turned out to be less than half
                what the longer runs actually cost, and correcting that is the reason this page
                quotes instead of claims. Put your exact destination into the{" "}
                <Link href="/tools/transfer-cost-calculator" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                  quote tool
                </Link>{" "}
                and you get the real number in seconds — and once quoted, it is fixed.
              </p>
            </div>
          </div>
        </section>

        {/* ── The resorts ──────────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-3">
              Where we <span className="text-gold-gradient">drive</span>
            </h2>
            <p className="text-dark-300 mb-8">
              Tell us the station and the address. Which sector you are staying in changes the
              drive more than the map suggests.
            </p>
            <div className="space-y-4">
              {RESORTS.map((r) => (
                <div key={r.name} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5 flex-wrap">
                    <h3 className="text-white text-base font-semibold">{r.name}</h3>
                    <span className="text-dark-400 text-xs">{r.area}</span>
                  </div>
                  <p className="text-dark-300 text-sm leading-relaxed">{r.note}</p>
                </div>
              ))}
            </div>
            <p className="text-dark-400 text-sm mt-6">
              Staying in a valley town rather than at a station? {" "}
              <Link href="/transfers/encamp" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">Encamp</Link>{" "}
              and{" "}
              <Link href="/transfers/andorra" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">Andorra la Vella</Link>{" "}
              both take the fixed Andorra fare, which is usually the cheaper way to arrive if you
              are happy to travel up to the lifts each morning.
            </p>
          </div>
        </section>

        {/* ── Ski luggage ──────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              The mistake almost everyone makes with <span className="text-gold-gradient">ski luggage</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                People book by seats. On a ski transfer the boot runs out long before the seats do:
                four passengers with four sets of skis, boots and a suitcase each need a
                considerably bigger vehicle than four passengers going to a hotel in Barcelona.
              </p>
              <p>
                Ski and board bags travel at no extra charge, but they have to be declared when you
                book so the right car is dispatched. A vehicle that arrives too small at midnight in
                the Pyrenees is not a problem anyone can solve at the roadside. The{" "}
                <Link href="/fleet" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">fleet page</Link>{" "}
                lists what each car actually holds.
              </p>
              <p>
                If you are hiring equipment at the resort rather than bringing it, say so — it
                changes the sizing entirely and often means a smaller, cheaper car.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {[
                { icon: Luggage, t: "Declare the kit", d: "Skis and boards are free to carry, but the car has to be chosen for them." },
                { icon: Mountain, t: "Name the station", d: "Sector matters. Soldeu and Pas de la Casa are forty minutes apart." },
                { icon: Snowflake, t: "Winter-ready", d: "Vehicles are equipped for the road conditions the season actually brings." },
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

        {/* ── Booking ──────────────────────────────────────────── */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Booking a <span className="text-gold-gradient">ski transfer</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-6">
              Give us the flight number, the resort and address, how many passengers, and how many
              sets of ski or board kit. You get a fixed quote back before paying anything, and it
              does not move afterwards — not for snow, not for a delay, not for the queue at the
              border.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {[
                "Quote confirmed before you pay",
                "Free cancellation up to 24 hours before",
                "Skis, boards and boot bags carried free",
                "Flight tracked, 60 minutes free waiting",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-dark-300 text-sm bg-dark-900 border border-white/[0.08] rounded-lg p-3.5">
                  <CheckCircle2 size={14} className="text-gold-500 flex-shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
            <p className="text-dark-400 text-sm mt-5">
              Booking the return at the same time is worth it on this route. Departure pickups from
              Andorra are timed backwards from your flight, and on a three-hour drive the margin
              matters. More on how we work is on the{" "}
              <Link href="/about" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">about page</Link>.
            </p>
          </div>
        </section>

        {/* ── FAQs ─────────────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
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
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <h2 className="font-display text-3xl text-white mb-3">Price your resort transfer</h2>
            <p className="text-dark-300 mb-7">
              Enter the station and we will quote the real road distance in seconds.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/tools/transfer-cost-calculator" className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold">
                Get a quote
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
