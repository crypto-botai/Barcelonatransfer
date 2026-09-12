import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CostCalculatorClient from "./CostCalculatorClient";
import { TAXI, AEROBUS, METRO, AIRPORT_TRAIN, faresCheckedLabel } from "@/lib/competing-fares";
import { SHARED_OG } from "@/lib/seo";
import { simpleBreadcrumb } from "@/lib/hub-schema";

const BASE = "https://www.elitebcn.info";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Airport Transfer Cost Calculator | Elite BCN" },
  description:
    "Compare Barcelona airport transfer costs: private chauffeur vs taxi vs Aerobus vs metro. Real prices by destination and group size. Instant comparison.",
  alternates: { canonical: `${BASE}/tools/transfer-cost-calculator` },
  keywords: ["barcelona airport transfer cost", "barcelona taxi vs private transfer", "aerobus vs private transfer barcelona", "barcelona transfer comparison"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Airport Transfer Cost Calculator",
    description: "Find the cheapest and best way to get from Barcelona Airport to your hotel, cruise port, or event venue. Compare private transfer, taxi, Aerobus and metro.",
    url: `${BASE}/tools/transfer-cost-calculator`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Barcelona Transfer Cost Comparison" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Airport Transfer Cost Calculator",
    description: "Compare private transfer vs taxi vs Aerobus vs metro — real Barcelona prices, instant results.",
    images: [`${BASE}/opengraph-image`],
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Barcelona Airport Transfer Cost Calculator",
  description:
    "Interactive tool to compare Barcelona airport transfer costs: private chauffeur vs metered taxi (T-1/T-2 tariffs) vs Aerobus vs metro, by destination and passenger count.",
  url: `${BASE}/tools/transfer-cost-calculator`,
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  author: { "@id": "https://www.elitebcn.info/#business" },
};

// This page sits under the root and never said so. Thirteen pages had no
// BreadcrumbList; eight were homepages, which correctly need none.
// One level, not two: there is no /tools index page, so a "Tools" crumb would
// point at this same URL and claim a parent that does not exist.
const BREADCRUMB = simpleBreadcrumb([{ name: "Transfer Cost Calculator", path: "/tools/transfer-cost-calculator" }]);

export default function TransferCostCalculatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <Navbar />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Free Tool</span>
            <h1 className="font-display text-4xl sm:text-5xl text-white mb-4">
              Barcelona Airport{" "}
              <span className="text-gold-gradient">Transfer Cost Calculator</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-xl mx-auto">
              Compare private chauffeur, metered taxi, Aerobus, and metro — with real Barcelona tariffs and your group size.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <CostCalculatorClient />

        {/* How it works */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-2xl text-white mb-8 text-center">
              How the <span className="text-gold-gradient">tariffs work</span>
            </h2>
            <div className="space-y-6 text-dark-300 text-sm leading-relaxed">
              {/*
                Every third-party figure below is read from lib/competing-fares,
                which carries the source and the date each was checked. The
                previous version of this section typed them in: the taxi tariff
                was a year out of date on every number, the Aerobús was 70 cents
                under, and the metro paragraph told readers to use a T-casual at
                the airport, where TMB does not accept it, then quoted a single
                fare that does not exist. The train, the cheapest option from
                T2 and the one a traveller most often asks about, was missing.
              */}
              <div>
                <h3 className="text-white font-semibold mb-1">Barcelona taxi, {TAXI.t1.label} day tariff</h3>
                <p>
                  {TAXI.t1.when}. Flagfall €{TAXI.t1.flagfall.toFixed(2)} plus €{TAXI.t1.perKm.toFixed(2)} per
                  kilometre. Every journey starting or ending at the airport adds a €{TAXI.airportSupplement.toFixed(2)}
                  supplement. A taxi booked by phone or app has a minimum fare of €{TAXI.minimumRadioOrApp.toFixed(2)}.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Barcelona taxi, {TAXI.t2.label} night and weekend tariff</h3>
                <p>
                  {TAXI.t2.when}. Flagfall €{TAXI.t2.flagfall.toFixed(2)} plus €{TAXI.t2.perKm.toFixed(2)} per
                  kilometre, with the same €{TAXI.airportSupplement.toFixed(2)} airport supplement. Long journeys
                  such as Andorra or Valencia may add motorway tolls, charged by the driver.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Taxi between the airport and the cruise port</h3>
                <p>
                  One fixed fare of €{TAXI.airportToCruiseFixed} between the airport and Moll Adossat, in either
                  direction, under Tarifa 4. That is the figure to compare against a private transfer for a cruise
                  connection, not the metered estimate above.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Aerobús</h3>
                <p>
                  €{AEROBUS.single.toFixed(2)} per person each way from either terminal to Plaça de Catalunya, or
                  €{AEROBUS.return.toFixed(2)} return. About {AEROBUS.minutes} minutes. Serves central Barcelona
                  only: not the cruise port, Sitges, Girona or anywhere else on this page.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Metro, L9 Sud</h3>
                <p>
                  €{METRO.airportTicket.toFixed(2)} per person with the Airport ticket, which is the only ticket
                  the airport stations accept: a T-casual or any other integrated card will not open the barrier
                  there. Up to {METRO.minutes} minutes to central stations, with luggage on escalators and a
                  change for most destinations. Not available for the cruise port, Sitges, Girona or anywhere
                  outside the metro network.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Train, Rodalies {AIRPORT_TRAIN.line}</h3>
                <p>
                  The cheapest of the public options and the one most often overlooked. It runs from Aeroport
                  station, which is at {AIRPORT_TRAIN.terminal}. About {AIRPORT_TRAIN.minutesToSants} minutes to Sants
                  or Passeig de Gràcia, roughly every {AIRPORT_TRAIN.everyMinutes} minutes. It is priced as a standard
                  Rodalies zone ticket from the station you board at, so we do not quote a single figure for it;
                  the current fare is on the Rodalies site.
                </p>
              </div>
              <p className="text-dark-500 text-xs pt-2 border-t border-white/[0.06]">
                Third-party fares checked {faresCheckedLabel()} against{" "}
                <a href={TAXI.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-gold-400">{TAXI.sourceLabel}</a>,{" "}
                <a href={AEROBUS.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-gold-400">{AEROBUS.sourceLabel}</a>,{" "}
                <a href={METRO.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-gold-400">{METRO.sourceLabel}</a> and{" "}
                <a href={AIRPORT_TRAIN.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-gold-400">{AIRPORT_TRAIN.sourceLabel}</a>.
                Our own fares are read live from the same price table the booking uses.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
