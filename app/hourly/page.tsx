import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { HOURLY_INCLUDED_KM, NIGHT_SURCHARGE_RATE } from "@/lib/pricing";
import { HOURLY_FLEET, HOURLY_FROM, HOURLY_MIN_HOURS } from "@/lib/hourly-fleet";
import HourlyRateGrid from "@/components/hourly/HourlyRateGrid";
import { SHARED_OG } from "@/lib/seo";

const BASE = "https://www.elitebcn.info";
const NIGHT_PCT = Math.round(NIGHT_SURCHARGE_RATE * 100);

export const metadata: Metadata = {
  title: { absolute: `Hourly Chauffeur Barcelona — Rates From €${HOURLY_FROM}/hr | Elite BCN` },
  description: `Hourly chauffeur hire in Barcelona: published per-hour rate for every vehicle, from €${HOURLY_FROM}/hr with ${HOURLY_INCLUDED_KM} km included and a ${HOURLY_MIN_HOURS}-hour minimum. Corolla to V-Class and Sprinter.`,
  alternates: { canonical: `${BASE}/hourly` },
  keywords: [
    "hourly chauffeur barcelona",
    "chauffeur by the hour barcelona",
    "barcelona chauffeur hourly rates",
    "private driver barcelona hourly",
    "car with driver barcelona per hour",
  ],
  openGraph: {
    ...SHARED_OG,
    title: `Hourly Chauffeur Barcelona — Rates From €${HOURLY_FROM}/hr | Elite BCN`,
    description: `Every vehicle's per-hour rate, published. From €${HOURLY_FROM}/hr, ${HOURLY_INCLUDED_KM} km included, ${HOURLY_MIN_HOURS}-hour minimum.`,
    url: `${BASE}/hourly`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Hourly Chauffeur Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Hourly Chauffeur Barcelona — Rates From €${HOURLY_FROM}/hr | Elite BCN`,
    description: `Every vehicle's per-hour rate, published. From €${HOURLY_FROM}/hr, ${HOURLY_INCLUDED_KM} km included.`,
    images: ["/opengraph-image"],
  },
};

/**
 * One Offer per car, priced the way hourly hire is actually sold.
 *
 * The trap here is the one /fleet fell into: publishing the bare hourly rate as
 * `price` tells a consumer that a V-Class costs 75 euros, when the smallest
 * booking anyone can make is four hours of it. So the rate goes in a
 * UnitPriceSpecification with a referenceQuantity of one hour, which is the
 * quantity the price applies to, and the four-hour floor goes in
 * eligibleQuantity as a minimum. Those two properties mean different things and
 * putting the minimum in referenceQuantity states a quarter of the real rate.
 */
const HOURLY_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Hourly Chauffeur Service Barcelona",
  serviceType: "Hourly Chauffeur Hire",
  provider: { "@id": `${BASE}/#business` },
  areaServed: { "@type": "City", name: "Barcelona", sameAs: "https://www.wikidata.org/wiki/Q1492" },
  description: `By-the-hour private chauffeur hire in Barcelona with a published rate for every vehicle. ${HOURLY_INCLUDED_KM} km included, minimum ${HOURLY_MIN_HOURS} hours.`,
  url: `${BASE}/hourly`,
  offers: HOURLY_FLEET.map((v) => ({
    "@type": "Offer",
    name: `${v.label} with chauffeur, by the hour`,
    itemOffered: {
      "@type": "Vehicle",
      name: v.label,
      vehicleSeatingCapacity: { "@type": "QuantitativeValue", value: v.maxPassengers },
    },
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: `${BASE}/book`,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(v.rate),
      priceCurrency: "EUR",
      unitCode: "HUR",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" },
      eligibleQuantity: { "@type": "QuantitativeValue", minValue: v.minHours, unitCode: "HUR" },
      valueAddedTaxIncluded: false,
    },
  })),
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Hourly chauffeur", item: `${BASE}/hourly` },
    ],
  },
};

const INCLUDED = [
  "The professional chauffeur, for the whole block",
  "The vehicle, fuel and city parking",
  `${HOURLY_INCLUDED_KM} km of driving, on every vehicle`,
  "Waiting between your stops, at no extra charge",
  "A chauffeur who speaks English and Spanish",
];

const NOT_INCLUDED = [
  "VAT, added at 10% only if you need an invoice",
  "Motorway tolls, where your route uses one",
  `A ${NIGHT_PCT}% surcharge on hours worked between 22:00 and 06:00`,
  `Driving beyond ${HOURLY_INCLUDED_KM} km, quoted before you travel`,
];

/**
 * Rates and minimums are read from the pricing module by every component on
 * this page, so these answers cannot quote a figure the booking would not
 * charge.
 */
const HOURLY_FAQS: Array<{ q: string; a: string }> = [
  {
    q: `What does the ${HOURLY_INCLUDED_KM} km allowance actually cover?`,
    a: `Every hourly rate on this page includes up to ${HOURLY_INCLUDED_KM} km of driving inside the block you book, on any vehicle. That is far more than a day of city stops uses, so in practice it only matters if your day runs out along the coast or up to Montserrat. Tell us the shape of the day when you book and we will say plainly whether you will pass it, and what the extra would be, before you travel rather than after.`,
  },
  {
    q: "Can the driver take us outside Barcelona?",
    a: `Yes. Inside the hours you book the itinerary is yours, including trips out of the city. Tell us roughly where you are going when you book so the right vehicle is sent, tolls can be estimated, and we can check the day against the ${HOURLY_INCLUDED_KM} km allowance. A day on the coast and a day of meetings in the Eixample are different jobs.`,
  },
  {
    q: "What happens if we run over the hours we booked?",
    a: "Extra time is billed at the same hourly rate, and we will always try to accommodate it. It is not guaranteed, because the driver may have another booking after yours, which is why booking one hour more than you think you need is usually the cheaper decision.",
  },
  {
    q: "Is the driver with us the whole time?",
    a: "Yes. The same driver and the same car stay with you for the whole block, waiting between stops. You are not matched with a different vehicle for each leg, and your things can stay in the car between stops.",
  },
  {
    q: "Is hourly hire cheaper than separate transfers?",
    a: "It depends on the shape of the day. Three or more stops usually favours hourly hire. Two fixed journeys with a long gap between them usually favours booking those as separate transfers. Send us the outline and we will tell you which is cheaper, including when that is the transfers.",
  },
  {
    q: "Do you charge a night surcharge?",
    a: `On hourly hire, yes: ${NIGHT_PCT}% between 22:00 and 06:00. Fixed-price transfers carry no night surcharge at all, at any hour, which is another reason a late airport run is better booked as a transfer than by the hour.`,
  },
  {
    q: "Which car should I book for a full day?",
    a: "For one or two passengers with light luggage the Corolla does the same job as anything else and costs the least. Book up a size if you are at the edge of the seating or carrying cases, because the difference in rate over a day is smaller than people expect and a case on somebody's lap for eight hours is not.",
  },
];

export default function HourlyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOURLY_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="pt-16 pb-14 sm:pt-24 sm:pb-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10 max-w-3xl">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
              Hourly Hire
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white mb-5 leading-[1.05]">
              Barcelona chauffeur, <span className="text-gold-gradient">by the hour</span>
            </h1>
            <p className="text-dark-400 text-lg mb-8 max-w-xl">
              Your driver and car for a block of hours. Every vehicle&apos;s rate is published below,
              with {HOURLY_INCLUDED_KM} km included.
            </p>
            <Link href="/book" className="btn-gold inline-block px-8 py-4 rounded-xl font-semibold">
              Book by the hour
            </Link>
          </div>
        </section>

        {/* The rate card, one row per car */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl sm:text-4xl text-white text-center mb-3">
              Hourly rates, <span className="text-gold-gradient">every vehicle</span>
            </h2>
            <p className="text-dark-400 text-sm text-center mb-10 max-w-2xl mx-auto">
              Per vehicle, not per passenger. One person and a full car pay the same rate, and the
              minimum booking is {HOURLY_MIN_HOURS} hours on every car.
            </p>
            <HourlyRateGrid />
            <p className="text-center text-dark-500 text-xs mt-8 max-w-xl mx-auto">
              Prices exclude VAT and tolls. The Lexus is offered on hourly hire only and shares the
              business saloon rate.
            </p>
          </div>
        </section>

        {/* What the rate covers */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white mb-8">
              What the rate <span className="text-gold-gradient">covers</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
              <div>
                <h3 className="text-white text-sm font-semibold mb-4">Included in the hourly rate</h3>
                <ul className="space-y-2.5">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex gap-2.5 text-dark-300 text-sm leading-relaxed">
                      <Check size={15} className="text-gold-400 flex-shrink-0 mt-[3px]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold mb-4">Charged separately</h3>
                <ul className="space-y-2.5">
                  {NOT_INCLUDED.map((item) => (
                    <li key={item} className="flex gap-2.5 text-dark-300 text-sm leading-relaxed">
                      <X size={15} className="text-dark-500 flex-shrink-0 mt-[3px]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* When to book by the hour instead */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              When hourly beats <span className="text-gold-gradient">separate transfers</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Hourly hire is not always the cheaper way to buy a day, and we would rather say so
                here than after you have paid. It wins when the car waits: three or more stops, a
                schedule that might move, luggage you would rather leave in the boot, or an evening
                where you do not yet know when you are leaving.
              </p>
              <p>
                Two journeys with a long gap between them is the case where it loses. Four hours of
                hire to cover a morning drop-off and an evening pick-up costs more than booking both
                as{" "}
                <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  fixed-price transfers
                </Link>
                , which also carry no night surcharge at any hour. An airport run at 23:00 is a
                transfer, not an hourly booking.
              </p>
              <p>
                If your day is a route rather than a schedule, the{" "}
                <Link href="/transfers" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  destination pages
                </Link>{" "}
                publish a fixed fare for it, and the{" "}
                <Link href="/tools/transfer-cost-calculator" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  cost calculator
                </Link>{" "}
                will price two vehicles side by side. Send us the outline either way and we will tell
                you which is cheaper.
              </p>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-8">
              Hourly hire <span className="text-gold-gradient">questions</span>
            </h2>
            <dl className="divide-y divide-white/[0.06]">
              {HOURLY_FAQS.map(({ q, a }) => (
                <div key={q} className="py-5 first:pt-0 last:pb-0">
                  <dt className="text-white font-medium mb-2">{q}</dt>
                  <dd className="text-dark-400 text-sm leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Close */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 text-center max-w-xl">
            <h2 className="font-display text-3xl text-white mb-4">
              Book your <span className="text-gold-gradient">block of hours</span>
            </h2>
            <p className="text-dark-400 text-sm mb-8">
              Confirmed in minutes, with the same driver and car for the whole booking.
            </p>
            <Link href="/book" className="btn-gold inline-block px-8 py-4 rounded-xl font-semibold">
              Book by the hour
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
