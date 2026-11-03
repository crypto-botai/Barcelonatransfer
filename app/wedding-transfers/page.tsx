import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Heart, Phone, Clock, Users, Route, ChevronRight, CalendarCheck } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";
import { HOURLY_FLEET } from "@/lib/hourly-fleet";
import { HOURLY_INCLUDED_KM } from "@/lib/pricing";
import { S_CLASS_HOURLY_IN_CITY, S_CLASS_HOURLY_OUT_OF_CITY } from "@/lib/s-class-pricing";
import { COMPANY } from "@/lib/company-facts";

const BASE = "https://www.elitebcn.info";
const PATH = "/wedding-transfers";
const UPDATED = "2026-11-03";
const UPDATED_LABEL = "3 November 2026";

/**
 * The cars a wedding party actually books, at the hourly rate the checkout charges. Read from the same module /hourly uses, so
 * a rate change in lib/pricing reaches this page without anyone retyping a number.
 */
const WEDDING_CARS = (["S_CLASS", "V_CLASS", "EQE_300", "VITO", "SPRINTER"] as const)
  .map((c) => HOURLY_FLEET.find((v) => v.vehicle === c))
  .filter((v): v is NonNullable<typeof v> => !!v);

const FROM = Math.min(...WEDDING_CARS.map((v) => v.rate));
const MIN_HOURS = Math.min(...WEDDING_CARS.map((v) => v.minHours));
const MAX_SEATS = Math.max(...WEDDING_CARS.map((v) => v.maxPassengers));

const TITLE = `Wedding Transport Barcelona — Chauffeur from €${FROM}/hr`;
const DESCRIPTION =
  `Wedding cars and guest shuttles in Barcelona and Catalonia: chauffeured by the hour from €${FROM}, up to ${MAX_SEATS} seats. Licensed VTC. Book online or on WhatsApp.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}${PATH}` },
  keywords: [
    "wedding transport barcelona", "wedding car hire barcelona", "wedding chauffeur barcelona",
    "wedding guest shuttle barcelona", "barcelona wedding transfer", "bridal car barcelona",
  ],
  openGraph: {
    ...SHARED_OG,
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE}${PATH}`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Elite BCN — Wedding transport in Barcelona" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${BASE}/opengraph-image`] },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does wedding transport in Barcelona cost?",
    a: `Wedding cars are booked by the hour. The rates are €${FROM} an hour and up depending on the car, with a minimum of ${MIN_HOURS} hours, and each rate covers up to ${HOURLY_INCLUDED_KM} km of driving. The table on this page lists every car at the price the booking charges. A couple's car for a ceremony and photographs is usually one car for four to six hours; guest shuttles are priced per vehicle, not per head.`,
  },
  {
    q: "How many guests can you move at once?",
    a: `The largest vehicle is the Mercedes Sprinter minibus, which seats up to ${MAX_SEATS}, and each car's seat count is on its fleet page. For a bigger party we arrange several vehicles as one booking with one contact, so a late arrival or a changed time moves every car together rather than one at a time.`,
  },
  {
    q: "Can one booking cover the ceremony, the photos and the reception?",
    a: "Yes. That is what hourly hire is for: the car stays with you across the day instead of being booked as separate point-to-point transfers. Give us the pickup, each stop and the finish, and we confirm the hours before you pay.",
  },
  {
    q: "What happens if the ceremony or the photographs run late?",
    a: "Tell the driver or message us on WhatsApp. Time past the booked hours is quoted before it is charged, never added afterwards. We do not publish an overtime rate because it depends on the car and on what is booked after you, so we agree it with you on the day.",
  },
  {
    q: "Do you drive to venues outside Barcelona?",
    a: "Yes. Weddings in the Costa Brava, around Sitges, in the Penedès and on the Tarragona coast are routine journeys for us. The hourly rate includes up to 150 km; a day that goes beyond that is quoted before the date, not on it.",
  },
  {
    q: "Can you collect guests from the airport as well?",
    a: "Yes. Airport transfers are fixed-price and flight-tracked, so a delayed flight does not leave anyone waiting, and they can be booked for the same day as the wedding. See the airport transfers page for how meeting points work at Terminal 1 and Terminal 2.",
  },
  {
    q: "Are you licensed, and do you decorate the cars?",
    a: "We are a licensed VTC operator and every car is valeted before each journey. We have not published a decoration service. If you want ribbons or flowers fitted, tell us what you have in mind when you book and we will say yes or no before you pay.",
  },
  {
    q: "How far ahead should we book?",
    a: "As early as the date is fixed. Saturdays from late spring to early autumn are the busiest, and the Sprinter and the V-Class are the first to go. Last-minute bookings are possible when a car is free, so ask, but do not leave a wedding day to chance.",
  },
];

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE },
    { "@type": "ListItem", position: 2, name: "Wedding transport", item: `${BASE}${PATH}` },
  ],
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Wedding transport in Barcelona",
  serviceType: "Chauffeur-driven wedding transport",
  provider: { "@id": `${BASE}/#business` },
  areaServed: [
    { "@type": "City", name: "Barcelona" },
    { "@type": "AdministrativeArea", name: "Catalonia" },
  ],
  description:
    "Chauffeur-driven cars and guest shuttles for weddings in Barcelona and across Catalonia, booked by the hour or as point-to-point transfers.",
  url: `${BASE}${PATH}`,
  dateModified: UPDATED,
  offers: WEDDING_CARS.map((v) => ({
    "@type": "Offer",
    name: `${v.label} with chauffeur, per hour`,
    priceCurrency: "EUR",
    priceSpecification: { "@type": "UnitPriceSpecification", price: v.rate, priceCurrency: "EUR", unitCode: "HUR", eligibleQuantity: { "@type": "QuantitativeValue", minValue: v.minHours, unitCode: "HUR" } },
  })),
};

const link = "text-gold-400 hover:text-gold-300 underline underline-offset-2";

export default function WeddingTransfersPage() {
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
              <ChevronRight size={14} className="text-dark-500" />
              <span className="text-gold-400">Wedding transport</span>
            </div>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6 leading-tight">
              Wedding Transport <br />
              <span className="text-gold-gradient">in Barcelona</span>
            </h1>
            <p className="text-dark-300 text-lg max-w-xl mx-auto mb-4">
              A chauffeur and a car for the whole day, from €{FROM} an hour, and shuttles for your guests.
              One booking, one contact, and a driver who knows the route.
            </p>
            <p className="text-dark-500 text-sm mb-10">Updated {UPDATED_LABEL} · Licensed VTC operator · Barcelona</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
                Book wedding transport <Heart size={15} />
              </Link>
              <a href={COMPANY.whatsapp} target="_blank" rel="noreferrer" className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
                <Phone size={15} /> WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* The answer, up front */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl space-y-4 text-dark-300 leading-relaxed">
            <h2 className="font-display text-3xl text-white">What wedding transport costs in Barcelona</h2>
            <p>
              Wedding cars at Elite BCN are booked by the hour, with a minimum of {MIN_HOURS} hours. The rates run from €{FROM} to
              €{Math.max(...WEDDING_CARS.map((v) => v.rate))} an hour depending on the car, and each includes up to {HOURLY_INCLUDED_KM} km of
              driving. Guests arriving from the airport, or moving between the ceremony and the reception, can be booked as
              fixed-price transfers instead. Both are priced by the same system as the online booking, so the figure you see here is
              the figure you pay.
            </p>
          </div>
        </section>

        {/* Cars and rates */}
        <section className="py-20 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-display text-3xl text-white text-center mb-3">
              Cars for the <span className="text-gold-gradient">wedding day</span>
            </h2>
            <p className="text-dark-400 text-center max-w-2xl mx-auto mb-12">
              Hourly rates with a chauffeur. Minimum {MIN_HOURS} hours, {HOURLY_INCLUDED_KM} km included.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {WEDDING_CARS.map((v) => (
                <Link key={v.vehicle} href={v.href} className="group bg-dark-900 border border-white/[0.08] rounded-2xl overflow-hidden hover:border-gold-500/30 transition-colors">
                  <div className="relative aspect-[16/10] bg-dark-950">
                    <Image src={v.image} alt={`${v.label} chauffeur car for weddings in Barcelona`} fill sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw" className="object-contain p-4" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-xl text-white mb-1">{v.label}</h3>
                    <p className="text-dark-400 text-sm mb-3">Up to {v.maxPassengers} passengers · {v.largeBags} large bags</p>
                    <p className="text-dark-300 text-sm leading-relaxed mb-4">{v.suitedTo}</p>
                    <p className="text-gold-400 font-display text-xl">€{v.rate} <span className="text-dark-400 text-sm font-sans">per hour, {v.minHours} hr min</span></p>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-dark-500 text-xs text-center mt-6">
              The Mercedes-Maybach S 580 is €{S_CLASS_HOURLY_IN_CITY} an hour in Barcelona and €{S_CLASS_HOURLY_OUT_OF_CITY} an hour outside it.
            </p>
          </div>
        </section>

        {/* What is covered */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              How we <span className="text-gold-gradient">run the day</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[
                { icon: Clock, title: "One car for the whole day", body: "Hourly hire keeps the same car and driver with you from the first pickup to the last drop, instead of separate transfers that each have to be found." },
                { icon: Users, title: "Guests moved together", body: "Several vehicles can be booked as one, on one schedule, with one person to call. A change to the timing reaches every car." },
                { icon: Route, title: "Venues across Catalonia", body: "Barcelona city, the Costa Brava, Sitges, the Penedès and the Tarragona coast. We confirm the route and the hours before you pay." },
                { icon: CalendarCheck, title: "Airport and hotel pickups", body: "Guests flying in are met with fixed-price, flight-tracked transfers, and can be taken to any hotel on the day or the day before." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-gold-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{title}</h3>
                    <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planning guidance */}
        <section className="py-20 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl space-y-4 text-dark-300 leading-relaxed">
            <h2 className="font-display text-3xl text-white">Planning your wedding transport</h2>
            <h3 className="font-display text-2xl text-white pt-2">A typical day, hour by hour</h3>
            <p>
              A couple&apos;s car for a ceremony in Barcelona, photographs and the move to the reception is usually four to six hours.
              Allow time for the photographs: they are the part of the day that overruns most often, and a car booked for exactly the
              ceremony has nothing left for them. Build in a quiet fifteen minutes before the first pickup so the driver is never the
              reason for a late start.
            </p>
            <h3 className="font-display text-2xl text-white pt-2">Choosing the car</h3>
            <p>
              The Mercedes-Maybach S 580 suits a couple who want one car with presence. The V-Class carries a bridal party
              of up to seven with room for dresses and bags. The Vito and the Sprinter are the guest vehicles: the Sprinter is the largest
              we run, and each fleet page lists exactly what it seats and holds. See the{" "}
              <Link href="/fleet" className={link}>full fleet</Link>.
            </p>
            <h3 className="font-display text-2xl text-white pt-2">Hourly or point to point?</h3>
            <p>
              If the car stays with you across several stops, hourly is the right structure, and the{" "}
              <Link href="/hourly" className={link}>hourly page</Link> has the rates and the rules. If a guest just needs to get from the
              airport to a hotel, or from a hotel to the ceremony, a fixed-price transfer is cheaper. The{" "}
              <Link href="/airport-transfers" className={link}>airport transfers page</Link> and the{" "}
              <Link href="/hotel-transfers" className={link}>hotel transfers page</Link> cover those.
            </p>
            <h3 className="font-display text-2xl text-white pt-2">Weddings outside the city</h3>
            <p>
              Many couples marry on the coast. We run to{" "}
              <Link href="/transfers/sitges" className={link}>Sitges</Link> and{" "}
              <Link href="/transfers/begur" className={link}>Begur</Link>, and across the Costa Brava and the Tarragona coast. The hourly
              rate includes {HOURLY_INCLUDED_KM} km; a longer day is quoted before the date. For a wedding that is part of a bigger
              programme, such as a private group or a company event, see our{" "}
              <Link href="/vip-transportation" className={link}>VIP transportation</Link> and{" "}
              <Link href="/corporate" className={link}>corporate</Link> pages.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">Wedding transport questions</h2>
            <div className="space-y-4">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl p-5 open:border-gold-500/30">
                  <summary className="cursor-pointer text-white font-semibold list-none flex justify-between gap-4">
                    {q}
                    <ChevronRight size={16} className="mt-1 flex-shrink-0 text-gold-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="text-dark-300 text-sm leading-relaxed mt-3">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white mb-4">Tell us the date and the venue</h2>
            <p className="text-dark-400 mb-8">
              Send the date, the pickup, the venue and the number of guests, and we will confirm the cars and the hours before you pay.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">Book online</Link>
              <a href={COMPANY.whatsapp} target="_blank" rel="noreferrer" className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
                <Phone size={15} /> {COMPANY.phoneDisplay}
              </a>
              <a href={COMPANY.whatsappUk} target="_blank" rel="noreferrer" className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
                <Phone size={15} /> {COMPANY.phoneUkDisplay}
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
