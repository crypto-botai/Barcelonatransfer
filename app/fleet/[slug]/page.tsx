import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Users, Briefcase, Star, Shield, Clock, ChevronRight, Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { VEHICLE_CATALOG, vehicleBadgeClass, BAG_SIZES, type FleetVehicle } from "@/types";
import { getFleetFromPrice, lookupFixedPriceByZone } from "@/lib/pricing";
import { SHARED_OG, fitTitle, fitDescription } from "@/lib/seo";

const SLUG_TO_CLASS: Record<string, FleetVehicle> = {
  "standard-sedan":    "COROLLA",
  "business-sedan":    "CAMRY",
  "tesla-model-3":     "TESLA_M3",
  "eqe-300-electric":  "EQE_300",
  "executive-minivan": "VITO",
  "luxury-minivan":    "V_CLASS",
  "group-minibus":     "SPRINTER",
};

const BASE = "https://www.elitebcn.info";

/**
 * The manufacturer, read off the vehicle itself.
 *
 * This was hardcoded to "Mercedes-Benz" for every vehicle, so the Product
 * schema on /fleet/standard-sedan told Google a Toyota Corolla was a Mercedes,
 * and the same on the Camry and the Tesla Model 3. Structured data that
 * contradicts the visible page is a Google policy violation and puts the rich
 * result on all seven pages at risk.
 */
function vehicleBrand(label: string): string {
  const make = label.split(" ")[0];
  // Mercedes vehicles are labelled "Mercedes ..." on site; the manufacturer's
  // registered name — and the one schema.org consumers match on — is hyphenated.
  return make === "Mercedes" ? "Mercedes-Benz" : make;
}

export function generateStaticParams() {
  return Object.keys(SLUG_TO_CLASS).map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const vehicleClass = SLUG_TO_CLASS[slug];
  if (!vehicleClass) return {};
  const vehicle = VEHICLE_CATALOG.find((v) => v.class === vehicleClass);
  if (!vehicle) return {};
  const minFare = getFleetFromPrice(vehicleClass as FleetVehicle);

  // Marked absolute: without it the layout appends "| Elite BCN Transfers" to a
  // title that already ends in "| Elite BCN", so every fleet page published the
  // brand twice and ran to 75-80 characters.
  //
  // Meet & greet is no longer listed as though it came with the fare — it is a
  // €5 extra, and saying otherwise here contradicted the rest of the site.
  const title = fitTitle([
    `${vehicle.label} — Barcelona Private Transfer`,
    `${vehicle.label} — Barcelona Transfer`,
    `${vehicle.label} Transfer Barcelona`,
    vehicle.label,
  ]);

  const description = fitDescription([
    `${vehicle.label} with a professional chauffeur in Barcelona, from €${minFare} fixed per vehicle.`,
    `Up to ${vehicle.maxPassengers} passengers. Flight tracking, no surge pricing.`,
  ]);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE}/fleet/${slug}` },
    keywords: [`barcelona ${vehicle.label.toLowerCase()} transfer`, `${vehicle.label.toLowerCase()} private hire barcelona`, "luxury chauffeur barcelona"],
    openGraph: {
      ...SHARED_OG,
      title,
      description,
      url: `${BASE}/fleet/${slug}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `Elite BCN — ${vehicle.label} Barcelona Private Transfer` }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function FleetVehiclePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const vehicleClass = SLUG_TO_CLASS[slug];
  if (!vehicleClass) return notFound();
  const vehicle = VEHICLE_CATALOG.find((v) => v.class === vehicleClass);
  if (!vehicle) return notFound();

  const minFare  = getFleetFromPrice(vehicleClass);

  // Seats and boot space are separate limits, and the boot is usually the one
  // that bites: the Tesla Model 3 seats four but takes two large cases, and the
  // Vito seats eight but takes four. Saying so plainly here prevents the
  // booking that arrives at the kerb with luggage that will not go in.
  const bagsShortOfSeats = vehicle.largeBags < vehicle.maxPassengers;

  const faqs: Array<{ q: string; a: string }> = [
    {
      q: `How much luggage fits in the ${vehicle.label}?`,
      a: `The boot takes ${vehicle.largeBags} large ${vehicle.largeBags === 1 ? "suitcase" : "suitcases"} of ${BAG_SIZES.large.cm}, or ${vehicle.mediumBags} medium (${BAG_SIZES.medium.cm}) or ${vehicle.smallBags} small (${BAG_SIZES.small.cm}) bags. Cabin bags can travel on empty seats when the car is not full. If you are carrying more than that, book the next vehicle up rather than hoping it fits.`,
    },
    {
      q: "Is the price per person or for the whole vehicle?",
      a: `Every fare is for the vehicle, not per seat. One passenger and ${vehicle.maxPassengers} passengers pay the same €${minFare} on the same route. Prices exclude VAT and tolls; 10% VAT is added only if you ask for an invoice.`,
    },
    {
      q: "What happens if my flight is delayed?",
      a: "We track your flight by its number and move the pickup to the actual landing time at no charge. Airport pickups include 60 minutes of free waiting from touchdown, which covers passport control and baggage reclaim on all but the worst days. City, port and station pickups include 15 minutes.",
    },
    {
      q: `Can I request child seats in the ${vehicle.label}?`,
      a: "Yes. Baby seats (0–13 kg), child seats (9–18 kg) and boosters (15–36 kg) are €5 each, up to two per booking, and are fitted before your driver sets off. Add them at the extras step when you book so the seat is in the car on the day.",
    },
    {
      q: "Is this a private transfer?",
      a: `Yes. The ${vehicle.label} is yours for the journey — we never combine bookings, share the vehicle with other passengers, or sell it seat by seat. Your driver takes you from your pickup point to your destination and nowhere else.`,
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: vehicle.label,
    description: vehicle.description,
    image: `${BASE}${vehicle.image}`,
    brand: { "@type": "Brand", name: vehicleBrand(vehicle.label) },
    offers: {
      "@type": "Offer",
      price: String(minFare),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: `${BASE}/book`,
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Fleet", item: `${BASE}/fleet` },
      { "@type": "ListItem", position: 3, name: vehicle.label, item: `${BASE}/fleet/${slug}` },
    ],
  };

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="pt-20">
        {/* Breadcrumb nav */}
        <div className="bg-[#050505] border-b border-white/[0.05] py-3">
          <div className="container mx-auto px-4 flex items-center gap-2 text-sm text-dark-400">
            <Link href="/" className="hover:text-gold-400 transition-colors">Home</Link>
            <ChevronRight size={13} className="text-dark-600" />
            <Link href="/fleet" className="hover:text-gold-400 transition-colors">Fleet</Link>
            <ChevronRight size={13} className="text-dark-600" />
            <span className="text-gold-400">{vehicle.label}</span>
          </div>
        </div>

        {/* Hero */}
        <section className="py-16 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Copy */}
              <div>
                {vehicle.badge && (
                  <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-black/30 mb-4 ${vehicleBadgeClass(vehicle.badge)}`}>{vehicle.badge}</span>
                )}
                <h1 className="font-display text-4xl sm:text-5xl text-white mb-4">
                  {vehicle.label}
                </h1>
                <p className="text-dark-300 text-lg leading-relaxed mb-6">{vehicle.description}</p>

                <div className="flex gap-6 mb-6">
                  <div className="flex items-center gap-2 text-white">
                    <Users size={16} className="text-gold-500" />
                    <span>Up to {vehicle.maxPassengers} passengers</span>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 text-white mb-3">
                    <Briefcase size={16} className="text-gold-500" />
                    <span className="text-sm text-dark-400 uppercase tracking-wider">Boot / trunk capacity</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-center">
                      <p className="text-gold-400 font-display text-2xl leading-tight">{vehicle.largeBags}</p>
                      <p className="text-white text-xs mt-1">Large</p>
                      <p className="text-dark-500 text-[10px] mt-0.5">{BAG_SIZES.large.cm}</p>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-center">
                      <p className="text-gold-400 font-display text-2xl leading-tight">{vehicle.mediumBags}</p>
                      <p className="text-white text-xs mt-1">Medium</p>
                      <p className="text-dark-500 text-[10px] mt-0.5">{BAG_SIZES.medium.cm}</p>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-center">
                      <p className="text-gold-400 font-display text-2xl leading-tight">{vehicle.smallBags}</p>
                      <p className="text-white text-xs mt-1">Small</p>
                      <p className="text-dark-500 text-[10px] mt-0.5">{BAG_SIZES.small.cm}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                  {vehicle.features.map((f) => (
                    <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-dark-300">
                      <CheckCircle2 size={12} className="text-gold-500 flex-shrink-0" /> {f}
                    </span>
                  ))}
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-display text-4xl text-gold-400">from €{minFare}</span>
                  <span className="text-dark-400 text-sm">fixed price · excl. VAT &amp; tolls</span>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/book?vehicle=${vehicleClass}`}
                    className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold"
                  >
                    Book this vehicle
                  </Link>
                  <Link
                    href="/fleet"
                    className="btn-outline-gold inline-flex items-center gap-2 px-6 py-4 rounded-xl text-sm"
                  >
                    All vehicles
                  </Link>
                </div>
              </div>

              {/* Image */}
              <div className="relative flex items-center justify-center">
                <div className="relative w-full aspect-[4/3] max-w-lg mx-auto"
                  style={{ background: "radial-gradient(ellipse at 60% 40%, #111, #060606)" }}>
                  <Image
                    src={vehicle.image}
                    alt={vehicle.label}
                    fill
                    priority
                    sizes="(max-width: 1024px) 90vw, 45vw"
                    className="object-contain p-8"
                    style={{ filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.9))" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why choose strip */}
        <section className="py-14 bg-dark-950 border-y border-white/[0.06]">
          <div className="container mx-auto px-4">
            {/* The three cards below are h3; without this every fleet page
                went h1 to h3. One template, seven pages. */}
            <h2 className="font-display text-2xl text-white text-center mb-8">
              What every transfer includes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Star,   title: "Fixed price guaranteed", body: "The price you see is the price you pay. No meter, no surge pricing, no airport fees at drop-off." },
                { icon: Shield, title: "60 min free waiting",    body: "For airport pickups, your driver waits up to 60 minutes from your actual landing time at no extra charge." },
                { icon: Clock,  title: "24/7 availability",      body: "Available day and night, every day of the year. Book online in 2 minutes with instant confirmation." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <Icon size={22} className="text-gold-500 mb-3" />
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing context */}
        <section className="py-14 bg-[#050505]">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Sample <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Route</th>
                    <th className="text-right text-dark-400 font-medium p-4">Fixed Price</th>
                  </tr>
                </thead>
                <tbody>
                  {((): Array<{ route: string; price: number | null }> => [
                    { route: "BCN Airport → Barcelona City",  price: lookupFixedPriceByZone("airport",        "barcelona_city", vehicleClass) },
                    { route: "BCN Airport → Montserrat",      price: lookupFixedPriceByZone("airport",        "montserrat",     vehicleClass) },
                    { route: "BCN Airport → Andorra",         price: lookupFixedPriceByZone("airport",        "andorra",        vehicleClass) },
                    { route: "Barcelona → Girona Airport",    price: lookupFixedPriceByZone("barcelona_city", "girona_airport", vehicleClass) },
                    { route: "Barcelona → Sitges",            price: lookupFixedPriceByZone("barcelona_city", "sitges",         vehicleClass) },
                  ])().filter((r) => r.price !== null).map((row) => (
                    <tr key={row.route} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-right">
                        <span className="text-gold-400 font-semibold">from €{row.price!}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-400 text-xs text-center mt-3">Fixed price per vehicle, excluding VAT and tolls. 10% VAT is added only if you request an invoice; tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet &amp; greet, child seats and other extras are optional and charged separately.</p>
          </div>
        </section>

        {/* Choosing this vehicle */}
        <section className="py-14 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Is the {vehicle.label} the <span className="text-gold-gradient">right choice</span>?
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                The {vehicle.label} carries up to {vehicle.maxPassengers}{" "}
                {vehicle.maxPassengers === 1 ? "passenger" : "passengers"} and takes{" "}
                {vehicle.largeBags} large {vehicle.largeBags === 1 ? "suitcase" : "suitcases"}{" "}
                in the boot. Those are two separate limits, and it is worth checking both before
                you book.{" "}
                {bagsShortOfSeats
                  ? `Travelling ${vehicle.maxPassengers}-up with a large case each will not fit — the boot holds ${vehicle.largeBags}. Either travel lighter, or move up to a vehicle with more room behind the seats.`
                  : `Boot space matches the seat count here, so a full car with a large case each is comfortable.`}
              </p>
              <p>
                Your fare covers the whole vehicle. It does not change with the number of
                passengers, it is agreed before you travel, and it does not move with traffic,
                time of day or the route your driver takes — there is no meter running. Tolls and
                VAT sit outside the quoted price, and VAT is only added if you request an invoice.
              </p>
              <p>
                Every journey is private. We do not combine bookings or share the vehicle with
                other passengers, so the {vehicle.label} goes from your pickup point to your
                destination without detours. Your driver is a licensed professional working under
                a Spanish VTC licence, and the car is cleaned between every transfer.
              </p>
              <p>
                Booking takes about two minutes and confirms immediately — you will have your
                driver&apos;s details before the day. If your plans change, tell us and we will move the
                booking; if you need a child seat, a name board at arrivals or a stop on the way,
                add it while booking so it is arranged in advance rather than negotiated at the kerb.
              </p>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="py-14 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-8">
              {vehicle.label} — common <span className="text-gold-gradient">questions</span>
            </h2>
            <div className="space-y-4">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
                  <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 text-white font-semibold hover:bg-white/[0.02] transition-colors">
                    <h3 className="text-base font-semibold">{q}</h3>
                    <ChevronRight size={18} className="text-gold-500 flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 text-dark-300 text-sm leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 text-center">
            <Zap size={24} className="text-gold-500 mx-auto mb-4" />
            <h2 className="font-display text-3xl text-white mb-3">Ready to book the {vehicle.label}?</h2>
            <p className="text-dark-400 mb-8">Fixed price confirmed instantly. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href={`/book?vehicle=${vehicleClass}`}
              className="btn-gold inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-lg"
            >
              Book Now — from €{minFare}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
