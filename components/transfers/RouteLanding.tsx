import Link from "next/link";
import {
  Clock, MapPin, ShieldCheck, CheckCircle2, ChevronRight,
  MessageCircle, Phone, Car,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { BAG_SIZES } from "@/types";
import { COMPANY } from "@/lib/company-facts";
import type { RouteLanding, PricedVehicle } from "@/lib/route-landings";

/**
 * The shell every commercial route landing page renders through.
 *
 * The 25 Aug audit found four priced zones with no page at all — LA_ROCA,
 * SANTS_STATION, VILANOVA and BEGUR — and the obvious fix was to copy
 * /transfers/barcelona-city-centre four times. That page is 574 lines. Four
 * copies is four places for a price, a fare caveat or a VAT sentence to drift
 * out of step, which is the failure this codebase has already had twice: the
 * hand-typed ladders on the destination pages, and the hand-typed offers in the
 * JSON-LD catalogue.
 *
 * So the layout lives here once and the pages are data. Adding a fifth route is
 * an entry in lib/route-landings.ts, not another 574 lines.
 *
 * Prices are never passed in as text. Each page resolves them through
 * lookupPriceByFleetVehicle at module scope, so a change in the price table
 * reaches the table, the hero, the FAQ answers and the JSON-LD Offer together
 * or reaches none of them.
 */

/**
 * Inline links inside prose, without pulling MDX in for four pages.
 *
 * Content is data, and data cannot hold JSX, but a route page that links to
 * nothing is exactly the orphan problem Phase 4 fixed. `[text](/path)` keeps
 * the prose readable in the data file and still emits a real <Link>, so these
 * pages contribute to the internal link graph rather than sitting outside it.
 */
export function prose(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[^)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link
        key={`${keyPrefix}-${i++}`}
        href={m[2]}
        className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40"
      >
        {m[1]}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function PriceTable({
  vehicles,
  caption,
}: {
  vehicles: PricedVehicle[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-dark-900">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-white/[0.08] bg-dark-800">
            <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Vehicle</th>
            <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Passengers</th>
            <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Large cases</th>
            <th scope="col" className="text-right p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Fixed fare</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
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
  );
}

export default function RouteLandingPage({ data }: { data: RouteLanding }) {
  const {
    name, h1, eyebrow, EyebrowIcon, heroLead, facts,
    priceTables, priceNote, included, excluded,
    options, optionsIntro, optionsNote,
    sections, faqs, ctaLead, cheapest,
  } = data;

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data.serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data.breadcrumbSchema) }} />

      <main className="pt-20">
        <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6">
          <ol className="flex items-center gap-2 text-xs text-dark-400">
            <li><Link href="/transfers" className="hover:text-gold-400 transition-colors">All Destinations</Link></li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="text-dark-300">{name}</li>
          </ol>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="py-14 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold-500/25 bg-gold-500/[0.05] text-gold-400 text-[11px] tracking-[0.2em] uppercase mb-5">
              <EyebrowIcon size={12} /> {eyebrow}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl text-white mb-5 leading-[1.1]">{h1}</h1>
            <p className="text-dark-300 text-lg leading-relaxed mb-7">
              {prose(heroLead, "lead")}
            </p>

            {/* Terse on purpose: this is the passage an AI assistant lifts when
                asked what the transfer costs. */}
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {facts.map(({ icon: Icon, k, v }) => (
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
              Fixed prices to <span className="text-gold-gradient">{name}</span>
            </h2>
            <p className="text-dark-300 mb-8">
              Per vehicle, not per person. One passenger and a full car pay the same fare.
            </p>

            {priceTables.map((t, idx) => (
              <div key={t.heading} className={idx > 0 ? "mt-10" : undefined}>
                <h3 className="text-white font-semibold mb-4">{t.heading}</h3>
                <PriceTable vehicles={t.vehicles} caption={t.caption} />
              </div>
            ))}

            <p className="text-dark-400 text-xs mt-3">
              Large case = {BAG_SIZES.large.cm}. {priceNote}
            </p>

            <h3 className="text-white font-semibold mt-10 mb-4">
              What the fare includes — and what it doesn&apos;t
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <p className="text-white text-sm font-medium mb-3">Included</p>
                <ul className="space-y-2">
                  {included.map((t) => (
                    <li key={t} className="flex gap-2 text-dark-300 text-sm">
                      <CheckCircle2 size={14} className="text-gold-500 flex-shrink-0 mt-0.5" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                <p className="text-white text-sm font-medium mb-3">Charged separately</p>
                <ul className="space-y-2 text-dark-300 text-sm">
                  {excluded.map((t) => <li key={t}>{t}</li>)}
                </ul>
                <p className="text-dark-400 text-xs mt-3">
                  See the{" "}
                  <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                    full fixed-price list
                  </Link>{" "}
                  for every route we publish.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison ───────────────────────────────────────── */}
        {options && (
          <section className="py-14 bg-[#050505]">
            <div className="container mx-auto px-4 max-w-3xl">
              <h2 className="font-display text-3xl text-white mb-3">
                How the options actually <span className="text-gold-gradient">compare</span>
              </h2>
              {optionsIntro && <p className="text-dark-300 mb-8">{optionsIntro}</p>}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-dark-900">
                <table className="w-full text-sm">
                  <caption className="sr-only">Ways to make this journey, compared</caption>
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-dark-800">
                      <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Option</th>
                      <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Cost</th>
                      <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Time</th>
                      <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Best for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((o) => (
                      <tr key={o.name} className="border-b border-white/[0.04] last:border-0 align-top">
                        <td className="p-3.5 text-white whitespace-nowrap">{o.name}</td>
                        <td className="p-3.5 text-dark-300">{o.cost}</td>
                        <td className="p-3.5 text-dark-300">{o.time}</td>
                        <td className="p-3.5 text-dark-300">{o.best}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {optionsNote && <p className="text-dark-400 text-sm mt-4">{prose(optionsNote, "optnote")}</p>}
            </div>
          </section>
        )}

        {/* ── Prose sections, alternating grounds ──────────────── */}
        {sections.map((s, i) => (
          <section
            key={s.h2}
            className={
              i % 2 === 0
                ? "py-14 bg-dark-950 border-y border-white/[0.06]"
                : "py-14 bg-[#050505]"
            }
          >
            <div className="container mx-auto px-4 max-w-3xl">
              <h2 className="font-display text-3xl text-white mb-6">
                {s.h2}{" "}
                {s.h2Accent && <span className="text-gold-gradient">{s.h2Accent}</span>}
              </h2>
              <div className="space-y-4 text-dark-300 leading-relaxed">
                {s.paras.map((p, j) => <p key={j}>{prose(p, `s${i}p${j}`)}</p>)}
              </div>
              {s.cards && (
                <div className="grid sm:grid-cols-3 gap-4 mt-8">
                  {s.cards.map(({ icon: Icon, t, d }) => (
                    <div key={t} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5">
                      <Icon size={18} className="text-gold-500 mb-3" aria-hidden="true" />
                      <p className="text-white text-sm font-medium mb-1.5">{t}</p>
                      <p className="text-dark-400 text-sm leading-relaxed">{d}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}

        {/* ── Booking ──────────────────────────────────────────── */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Booking your <span className="text-gold-gradient">transfer</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-6">
              {prose(data.bookingLead, "booking")}
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {[
                "Fixed price confirmed before you pay",
                "Free cancellation up to 24 hours before",
                "Licensed VTC operator, fully insured",
                "Pay by card, or in cash to the driver",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-dark-300 text-sm bg-dark-900 border border-white/[0.08] rounded-lg p-3.5">
                  <CheckCircle2 size={14} className="text-gold-500 flex-shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
            <p className="text-dark-400 text-sm mt-5">
              More detail on how we work is on the{" "}
              <Link href="/about" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                about page
              </Link>
              , and the{" "}
              <Link href="/faq" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">
                FAQ
              </Link>{" "}
              answers the questions that come up most.
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
              {faqs.map(({ q, a }) => (
                <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
                  <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                    <h3 className="text-white text-base font-semibold">{q}</h3>
                    <ChevronRight size={18} className="text-gold-500 flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 text-dark-300 text-sm leading-relaxed">{prose(a, `faq-${q.slice(0, 12)}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <h2 className="font-display text-3xl text-white mb-3">Book your {name} transfer</h2>
            <p className="text-dark-300 mb-7">{ctaLead}</p>
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
            <p className="sr-only">From €{cheapest} per vehicle.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export { Clock, MapPin, ShieldCheck, Car };
