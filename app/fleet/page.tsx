import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FleetSection from "@/components/sections/FleetSection";
import Link from "next/link";
import { SHARED_OG } from "@/lib/seo";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import { VEHICLE_CATALOG, BAG_SIZES } from "@/types";
import { fleetPagePath } from "@/lib/fleet-pages";
import { amenitySentence, FLEET_FACTS } from "@/lib/fleet-facts";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Fleet — Mercedes V-Class & Tesla | Elite BCN" },
  description:
    "Barcelona private transfer fleet: Mercedes V-Class, EQE 300 Electric, Tesla Model 3 & Vito. Seven cars, fixed prices, per vehicle not per seat.",
  alternates: { canonical: "https://www.elitebcn.info/fleet" },
  keywords: ["barcelona transfer fleet", "mercedes v-class barcelona", "tesla model 3 barcelona transfer", "luxury chauffeur barcelona fleet"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Fleet — Mercedes V-Class & Tesla | Elite BCN",
    description: "Mercedes V-Class, EQE 300 Electric & Tesla Model 3. Premium private hire fleet for Barcelona airport transfers.",
    url: "https://www.elitebcn.info/fleet",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Luxury Fleet Barcelona Transfers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Fleet — Mercedes V-Class & Tesla | Elite BCN",
    description: "Mercedes V-Class, EQE 300 Electric & Tesla Model 3. Premium private hire fleet for Barcelona airport transfers.",
    images: ["/opengraph-image"],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type":    "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Fleet", item: "https://www.elitebcn.info/fleet" },
  ],
};

const fleetSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Elite BCN Transfers Fleet",
  description: "Luxury private transfer fleet available in Barcelona — fixed prices, no surge pricing.",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Product",
        name: "Mercedes V-Class — Luxury 7-Seat Minivan",
        description: "7-seat luxury MPV ideal for groups and families. Perfect for airport transfers from Barcelona El Prat.",
        image: "https://www.elitebcn.info/fleet/v-class-mercedes.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: String(HOURLY_RATES.LUXURY_MINIVAN), priceCurrency: "EUR", priceSpecification: { "@type": "UnitPriceSpecification", price: String(HOURLY_RATES.LUXURY_MINIVAN), priceCurrency: "EUR", unitCode: "HUR", referenceQuantity: { "@type": "QuantitativeValue", value: MIN_HOURLY_HOURS.LUXURY_MINIVAN, unitCode: "HUR" } }, availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Product",
        name: "Mercedes EQE 300 Electric — Executive Saloon",
        description: "Premium all-electric executive saloon for airport transfers in Barcelona. Up to 4 passengers. Zero emissions.",
        image: "https://www.elitebcn.info/fleet/eqe-300.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: String(HOURLY_RATES.BUSINESS), priceCurrency: "EUR", priceSpecification: { "@type": "UnitPriceSpecification", price: String(HOURLY_RATES.BUSINESS), priceCurrency: "EUR", unitCode: "HUR", referenceQuantity: { "@type": "QuantitativeValue", value: MIN_HOURLY_HOURS.BUSINESS, unitCode: "HUR" } }, availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Product",
        name: "Mercedes Vito — Executive 8-Seat Minivan",
        description: "Executive minivan for groups up to 8 passengers. Spacious and practical for families and large groups.",
        image: "https://www.elitebcn.info/fleet/mercedes-vito.png",
        brand: { "@type": "Brand", name: "Mercedes-Benz" },
        offers: { "@type": "Offer", price: String(HOURLY_RATES.MINIVAN), priceCurrency: "EUR", priceSpecification: { "@type": "UnitPriceSpecification", price: String(HOURLY_RATES.MINIVAN), priceCurrency: "EUR", unitCode: "HUR", referenceQuantity: { "@type": "QuantitativeValue", value: MIN_HOURLY_HOURS.MINIVAN, unitCode: "HUR" } }, availability: "https://schema.org/InStock", url: "https://www.elitebcn.info/book" },
      },
    },
  ],
};

export default function FleetPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fleetSchema) }} />
      <main className="pt-20">
        {/* Page header */}
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Our Fleet</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Luxury Vehicle <span className="text-gold-gradient">Fleet Barcelona</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              From economy saloons to a sixteen-seat minibus — seven vehicles, each with a published
              capacity and a published fare. Every car lists what it actually carries, because seats and
              boot space run out at different points.
            </p>
          </div>
        </section>

        <FleetSection />

        {/* ── Choosing between them ────────────────────────────────
            The hub introduced seven cars and gave a reader nothing to
            decide with. Every figure below is read from VEHICLE_CATALOG,
            so a change to a car reaches this page with it. */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              How to choose the <span className="text-gold-gradient">right car</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Seats and boot space are separate limits, and they run out at different points.
                Four adults fit comfortably in a saloon; four adults with four large suitcases do
                not, whatever the seat count says. On an airport run the boot is almost always the
                constraint that bites first, which is why every car below lists both numbers.
              </p>
              <p>
                A large case here means {BAG_SIZES.large.cm}. If your group is at the edge of a
                vehicle&apos;s seating, book one size up — the difference in fare is usually smaller
                than people expect, and it is the difference between a comfortable journey and a
                case on someone&apos;s lap for forty minutes.
              </p>
              <p>
                The price is per vehicle, not per person. A family of four pays the vehicle fare
                once rather than four times, so the larger cars are often better value per head than
                they look. Every route fare is published on the{" "}
                <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">pricing page</Link>,
                and the{" "}
                <Link href="/tools/transfer-cost-calculator" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">quote tool</Link>{" "}
                will price two vehicles side by side.
              </p>
            </div>

            <h3 className="text-white font-semibold mt-10 mb-4">Capacity at a glance</h3>
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-dark-900">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Every vehicle in the fleet with its passenger and luggage capacity
                </caption>
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Vehicle</th>
                    <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Passengers</th>
                    <th scope="col" className="text-center p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Large cases</th>
                    <th scope="col" className="text-left p-3.5 text-dark-400 font-medium text-xs uppercase tracking-wider">Suited to</th>
                  </tr>
                </thead>
                <tbody>
                  {VEHICLE_CATALOG.map((v) => (
                    <tr key={v.class} className="border-b border-white/[0.04] last:border-0 align-top">
                      <td className="p-3.5">
                        <Link href={fleetPagePath(v.class)} className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/30">
                          {v.label}
                        </Link>
                      </td>
                      <td className="p-3.5 text-center text-dark-300">{v.maxPassengers}</td>
                      <td className="p-3.5 text-center text-dark-300">{v.largeBags}</td>
                      <td className="p-3.5 text-dark-300">{v.badge}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-400 text-xs mt-3">
              {amenitySentence()} WiFi is listed on {FLEET_FACTS.wifiCount} of the{" "}
              {FLEET_FACTS.total} — the exceptions are the V-Class and the Sprinter.
            </p>

            <h3 className="text-white font-semibold mt-10 mb-4">What the classes mean in practice</h3>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                <strong className="text-white">Economy and Business saloons</strong> cover the great
                majority of transfers: one to three passengers with normal luggage. The difference
                between them is comfort and finish rather than capacity, so if the boot is enough,
                the cheaper car does the same job.
              </p>
              <p>
                <strong className="text-white">Electric</strong> — the Tesla Model 3 and the Mercedes
                EQE 300 — are the same size class as the saloons and cost the same or a little more.
                Worth asking for if you would rather not arrive after an hour of diesel.
              </p>
              <p>
                <strong className="text-white">Minivans</strong> are the honest answer for families
                and for groups with holiday luggage. The Vito takes more people, the V-Class fewer
                but in considerably more comfort, with captain seats and room to face one another.
              </p>
              <p>
                <strong className="text-white">The Sprinter</strong> is for groups the cars cannot
                take — up to sixteen with a separate luggage hold. For anything larger, or for
                several vehicles moving together, the{" "}
                <Link href="/corporate" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">corporate page</Link>{" "}
                covers how group bookings are handled.
              </p>
              <p>
                By-the-hour hire is available on every vehicle from €{HOURLY_RATES.ECONOMY} an hour
                with a {MIN_HOURLY_HOURS.ECONOMY}-hour minimum, which is usually better value than
                separate transfers once a day involves three or more stops. The{" "}
                <Link href="/hourly" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">hourly chauffeur page</Link>{" "}
                has the full rates.
              </p>
            </div>

            <h3 className="text-white font-semibold mt-10 mb-4">Child seats and extras</h3>
            <p className="text-dark-300 leading-relaxed">
              Child, baby and booster seats are available on every vehicle and are fitted before the
              car is dispatched, so they have to be requested when you book rather than on the day.
              They are a paid extra, not included. Meet and greet with a name board inside arrivals
              is also optional — the{" "}
              <Link href="/faq" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">FAQ</Link>{" "}
              lists what each extra costs, and the{" "}
              <Link href="/about" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">about page</Link>{" "}
              covers how we operate.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl text-white mb-4">Ready to Book?</h2>
            <p className="text-dark-400 mb-8">Instant online booking. Confirmed in seconds.</p>
            <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold">
              Book Your Vehicle
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
