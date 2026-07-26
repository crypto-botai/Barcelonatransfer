import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Users, Briefcase, Star, Shield, Clock, ChevronRight, Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { VEHICLE_CATALOG, vehicleBadgeClass, type FleetVehicle } from "@/types";
import { getFleetFromPrice, lookupFixedPriceByZone } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

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

  return {
    title: `${vehicle.label} — Barcelona Private Transfer | Élite BCN`,
    description: `${vehicle.description} From €${minFare} fixed price. Meet & greet, flight tracking, no surge pricing.`,
    alternates: { canonical: `${BASE}/fleet/${slug}` },
    keywords: [`barcelona ${vehicle.label.toLowerCase()} transfer`, `${vehicle.label.toLowerCase()} private hire barcelona`, "barcelona airport transfer", "luxury chauffeur barcelona"],
    openGraph: {
      ...SHARED_OG,
      title: `${vehicle.label} — Barcelona Private Transfer`,
      description: `From €${minFare}. Fixed-price private transfer in ${vehicle.label}. No surge pricing, ever.`,
      url: `${BASE}/fleet/${slug}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `Élite BCN — ${vehicle.label} Barcelona Private Transfer` }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${vehicle.label} — Barcelona Private Transfer | Élite BCN`,
      description: `From €${minFare}. Fixed-price private transfer in ${vehicle.label}. Meet & greet, flight tracking, no surge pricing.`,
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

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: vehicle.label,
    description: vehicle.description,
    image: `${BASE}${vehicle.image}`,
    brand: { "@type": "Brand", name: "Mercedes-Benz" },
    offers: {
      "@type": "Offer",
      price: String(minFare),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: `${BASE}/book`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "312",
      bestRating: "5",
      worstRating: "1",
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
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${vehicleBadgeClass(vehicle.badge)}`}>{vehicle.badge}</span>
                )}
                <h1 className="font-display text-4xl sm:text-5xl text-white mb-4">
                  {vehicle.label}
                </h1>
                <p className="text-dark-300 text-lg leading-relaxed mb-6">{vehicle.description}</p>

                <div className="flex gap-6 mb-8">
                  <div className="flex items-center gap-2 text-white">
                    <Users size={16} className="text-gold-500" />
                    <span>Up to {vehicle.maxPassengers} passengers</span>
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Briefcase size={16} className="text-gold-500" />
                    <span>Up to {vehicle.maxLuggage} bags</span>
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
                  <span className="text-dark-400 text-sm">incl. VAT · fixed price</span>
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
            <p className="text-dark-500 text-xs text-center mt-3">All prices are fixed and include tolls, meet & greet, and up to 60 min free waiting.</p>
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
