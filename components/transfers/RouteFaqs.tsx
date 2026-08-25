import Link from "next/link";
import { ladderFor } from "@/lib/destination-pricing";

/**
 * The practical section the five hand-built destination pages never had.
 *
 * /transfers/tarragona, /montserrat, /sitges, /port-aventura and /girona all
 * share one shape — hero, features, "About X", price table, CTA — and all five
 * stopped between 384 and 402 words. They are commercial pages for destinations
 * people search by name, competing against guides two and three times their
 * length, and none of them answered a single question a person actually asks
 * before booking.
 *
 * The answers are per-destination because a generic block would be filler, but
 * the fares inside them are read from the price table through ladderFor(), so
 * this cannot quote a figure the checkout would not charge — the failure that
 * put a €35 cruise fare on a page against a real €60.
 *
 * No FAQPage markup. Google retired FAQ rich results for every site on
 * 7 May 2026, so the schema earns nothing; the answers are here because they
 * are useful to read, which is the only reason left to write them.
 */

export interface RouteFaqSpec {
  /**
   * The PRICING ZONE key, not the page slug.
   *
   * These coincide for Sitges and diverge for the others — /transfers/girona
   * prices the zone "girona_airport" and /transfers/port-aventura the zone
   * "portaventura". Passing the slug returned null from ladderFor() and the
   * whole section silently rendered nothing on both pages.
   */
  zone: string;
  /**
   * Which end the page's own price table quotes from, so this section cannot
   * contradict the table directly above it. Girona leads on the city fare
   * (EUR 140) and also publishes the airport one (EUR 165); quoting the wrong
   * end here would recreate the drift this file exists to avoid.
   */
  origin?: "airport" | "barcelona_city";
  name: string;
  distance: string;
  duration: string;
  /** Destination-specific questions. The fare question is added automatically. */
  faqs: Array<{ q: string; a: string }>;
  /** Two or three related pages, for the reader and for the link graph. */
  related?: Array<{ href: string; label: string }>;
}

export default function RouteFaqs({ spec }: { spec: RouteFaqSpec }) {
  const origin = spec.origin ?? "airport";
  const ladder = ladderFor(spec.zone, origin);
  // Never silently render nothing: a missing ladder means the zone key is wrong,
  // which is a bug rather than a page that legitimately has no price.
  if (!ladder) {
    throw new Error(
      `RouteFaqs: no published ladder for zone "${spec.zone}" from "${origin}". ` +
        `Check the zone key against SLUG_TO_ZONE in lib/destination-pricing.ts.`,
    );
  }
  const fromAirport = origin === "airport";

  const faqs = [
    {
      q: `How much is a transfer from Barcelona to ${spec.name}?`,
      a: `From €${ladder.economy} for an economy sedan, fixed per vehicle rather than per person, so a group pays once. A minivan for four to eight passengers is €${ladder.minivan}, and the full ladder is in the table above. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.`,
    },
    {
      q: "How long does the journey take?",
      a: `${spec.distance} and about ${spec.duration} in normal traffic. Allow longer at rush hour and on summer weekends, when the coastal and inland roads out of Barcelona both carry holiday traffic. The fare does not change when the traffic does.`,
    },
    ...spec.faqs,
    fromAirport
      ? {
          q: "What happens if my flight is delayed?",
          a: "We track your flight by its number and move the pickup to the actual landing time at no charge. Airport pickups include 60 minutes of free waiting from touchdown, which covers passport control and baggage reclaim on all but the worst days.",
        }
      : {
          q: "How does the pickup work if I am starting in Barcelona?",
          a: "The driver comes to the address you give — a hotel, an apartment or a private address, all at the same fare — and waits 15 minutes at no charge. If you are connecting from a flight instead, say so when you book and the pickup is tracked to your landing time with 60 minutes of free waiting.",
        },
    {
      q: "Is this a private car or a shared shuttle?",
      a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours from the pickup to the door.",
    },
  ];

  return (
    <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="font-display text-3xl text-white mb-8">
          {spec.name} transfers — <span className="text-gold-gradient">common questions</span>
        </h2>

        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <h3 className="text-white text-base font-semibold">{q}</h3>
                <span aria-hidden="true" className="text-gold-500 flex-shrink-0 transition-transform group-open:rotate-90">
                  &rsaquo;
                </span>
              </summary>
              <p className="px-5 pb-5 text-dark-300 text-sm leading-relaxed">{a}</p>
            </details>
          ))}
        </div>

        <h3 className="text-white font-semibold mt-10 mb-4">Booking and payment</h3>
        <div className="space-y-4 text-dark-300 leading-relaxed">
          <p>
            Give us the pickup address, the date and the number of passengers, and the price is
            confirmed before you pay. It does not move afterwards — not for traffic, not for the hour
            of the day, and not for a public holiday. You can pay by card when you book or in cash to
            the driver, and cancellation is free up to 24 hours before pickup.
          </p>
          <p>
            Book the vehicle by boot space rather than by seats. Seats and luggage are separate
            limits and the boot usually runs out first, particularly on a holiday route where people
            travel with full suitcases. Every car&apos;s capacity is listed on the{" "}
            <Link href="/fleet" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              fleet page
            </Link>
            , and child seats can be added at booking for a small fee — they are fitted before the
            car is dispatched, so they cannot be arranged on the day.
          </p>
          {spec.related && spec.related.length > 0 && (
            <p>
              Travelling on elsewhere? See{" "}
              {spec.related.map((r, i) => (
                <span key={r.href}>
                  <Link href={r.href} className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                    {r.label}
                  </Link>
                  {i < spec.related!.length - 2 ? ", " : i === spec.related!.length - 2 ? " or " : ""}
                </span>
              ))}
              . Every published fare is on the{" "}
              <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                pricing page
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
