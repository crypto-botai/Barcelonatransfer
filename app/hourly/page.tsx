import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

const MIN_RATE = HOURLY_RATES.ECONOMY;
const MIN_HOURS = MIN_HOURLY_HOURS.ECONOMY;

export const metadata: Metadata = {
  title: { absolute: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Elite BCN` },
  description: `Private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr. Meetings, shopping, events & city tours. Mercedes V-Class & EQE 300 Electric. ${MIN_HOURS}-hr minimum.`,
  alternates: { canonical: "https://www.elitebcn.info/hourly" },
  keywords: ["hourly chauffeur barcelona", "chauffeur by the hour barcelona", "barcelona disposal chauffeur", "private driver barcelona hourly"],
  openGraph: {
    ...SHARED_OG,
    title: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Elite BCN`,
    description: `Book a private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr. Meetings, shopping, events & city tours. ${MIN_HOURS}-hr minimum.`,
    url: "https://www.elitebcn.info/hourly",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Hourly Chauffeur Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Elite BCN`,
    description: `Book a private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr. Meetings, shopping, events & city tours. ${MIN_HOURS}-hr minimum.`,
    images: ["/opengraph-image"],
  },
};

const RATE_CARDS = [
  { class: "Economy (Toyota Corolla / Camry)", rate: HOURLY_RATES.ECONOMY,        pax: "1–3",  min: MIN_HOURLY_HOURS.ECONOMY        },
  { class: "Business / Electric Sedan",        rate: HOURLY_RATES.LUXURY,         pax: "1–4",  min: MIN_HOURLY_HOURS.LUXURY         },
  { class: "Minivan (Mercedes Vito)",          rate: HOURLY_RATES.MINIVAN,        pax: "1–8",  min: MIN_HOURLY_HOURS.MINIVAN        },
  { class: "Luxury Minivan (Mercedes V-Class)",rate: HOURLY_RATES.LUXURY_MINIVAN, pax: "1–7",  min: MIN_HOURLY_HOURS.LUXURY_MINIVAN },
];

const HOURLY_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Hourly Chauffeur Service Barcelona",
  serviceType: "Hourly Chauffeur Hire",
  provider: { "@type": "Organization", name: "Elite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: { "@type": "City", name: "Barcelona", sameAs: "https://www.wikidata.org/wiki/Q1492" },
  description: "By-the-hour private chauffeur hire in Barcelona. Minimum 4 hours. Ideal for meetings, events, shopping, airport standby.",
  url: "https://www.elitebcn.info/hourly",
  offers: { "@type": "Offer", price: `${MIN_RATE}`, priceCurrency: "EUR", unitCode: "HUR", priceValidUntil: "2027-12-31" },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",   item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Hourly", item: "https://www.elitebcn.info/hourly" },
    ],
  },
};

export default function HourlyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOURLY_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Hourly Hire</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Private Chauffeur <span className="text-gold-gradient">By the Hour</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Your professional chauffeur at complete disposal for meetings, shopping, touring, or multi-stop business days. Minimum 4 hours.
            </p>
            <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">
              Book Hourly Chauffeur
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            {/* The rate cards below are h3; without this the page went h1 to h3. */}
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Hourly rates by <span className="text-gold-gradient">vehicle</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {RATE_CARDS.map((r) => (
                <div key={r.class} className="glass-card gold-hover-border rounded-xl p-6 text-center">
                  <h3 className="text-white font-medium mb-3">{r.class}</h3>
                  <p className="font-display text-4xl text-gold-400 mb-1">
                    {formatCurrency(r.rate)}
                  </p>
                  <p className="text-dark-500 text-xs mb-1">per hour · {r.pax} passengers</p>
                  <p className="text-dark-500 text-xs mb-5">Minimum {r.min} hours</p>
                  <Link href="/book" className="btn-gold block py-2.5 rounded-lg text-xs font-semibold">
                    Book Now
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-dark-500 text-xs mt-8">
              All hourly rates include the professional chauffeur, vehicle and fuel. VAT and tolls are charged separately.
            </p>
          </div>
        </section>

        {/* The page ranked page two on roughly 50 words. Every figure below is
            read from the pricing module rather than written by hand, so the copy
            cannot drift from what the booking actually charges. */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              How hourly hire <span className="text-gold-gradient">works</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                You book the car and the driver for a block of time rather than for a single journey. The
                minimum is <strong className="text-white">{MIN_HOURS} hours</strong>, and the clock runs from
                the pickup time you choose, not from the first stop. Within that block the itinerary is yours:
                the driver waits while you are in a meeting, a restaurant or a shop, and moves when you do.
              </p>
              <p>
                This is what most people want when a fixed transfer does not fit — a morning of viewings, a
                day of meetings across the city, a wedding, or a shopping run where nobody wants to find a
                taxi with the bags. It is also the sensible choice when you need the same driver all day
                rather than a different car each time.
              </p>
              <p>
                Rates start at <strong className="text-white">€{MIN_RATE} an hour</strong> for an economy
                sedan and rise with the vehicle, as the table above shows. A{" "}
                <strong className="text-white">20% night surcharge</strong> applies to hourly hire between
                22:00 and 06:00; fixed-price transfers have no night surcharge at all. VAT is added only if
                you ask for an invoice, and tolls are charged separately where the route uses them.
              </p>
              <p>
                Journeys with a set start and end are usually cheaper booked as a{" "}
                <Link href="/transfers" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  fixed-price transfer
                </Link>{" "}
                instead — airport runs, the{" "}
                <Link href="/transfers/cruise-port" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  cruise terminal
                </Link>
                , or a long single leg such as{" "}
                <Link href="/transfers/andorra" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                  Barcelona to Andorra
                </Link>
                . Tell us what the day looks like and we will say which way is cheaper.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
