import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import destinations from "@/data/destinations.json";
import { STATIC_TRANSFER_PAGES } from "@/data/static-transfer-pages";
import { SHARED_OG } from "@/lib/seo";
import { getPlacePrices, getDestinationPrices, SLUG_TO_ZONE, type ResolvedPlacePrices } from "@/lib/destination-pricing";

type Destination = (typeof destinations)[number];

const BASE = "https://www.elitebcn.info";

function getDestination(slug: string): Destination | undefined {
  return destinations.find((d) => d.slug === slug);
}

export async function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dest = getDestination(slug);
  if (!dest) return { title: "Transfer | Élite BCN" };

  return {
    title: { absolute: `${dest.name} — Barcelona Airport Transfer | Élite BCN` },
    description: dest.description,
    alternates: {
      canonical: `${BASE}/transfers/${slug}`,
    },
    keywords: [`${dest.name.toLowerCase()} barcelona transfer`, `barcelona airport ${dest.name.toLowerCase()} transfer`, "private transfer barcelona"],
    openGraph: {
      ...SHARED_OG,
      title: `${dest.name} — Barcelona Airport Transfer | Élite BCN`,
      description: dest.description,
      url: `${BASE}/transfers/${slug}`,
      images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: `Élite BCN — Transfer to ${dest.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Barcelona Airport → ${dest.name} — from €${(await getPlacePrices(dest.coordinates.lat, dest.coordinates.lng, dest.distance_km))?.economy ?? dest.prices.sedan} fixed`,
      description: dest.description,
      images: [`${BASE}/opengraph-image`],
    },
  };
}

function buildSchema(dest: Destination, prices: ResolvedPlacePrices | null) {
  // Schema must state the fare the checkout will actually charge.
  const sedan = prices?.economy ?? dest.prices.sedan;
  const mpv   = prices?.minivan ?? dest.prices.mpv;
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Barcelona Airport to ${dest.name} Private Transfer`,
    description: dest.description,
    provider: {
      "@type": "LocalBusiness",
      name: "Élite BCN Transfers",
      url: BASE,
      telephone: "+34635383712",
    },
    areaServed: [
      { "@type": "City", name: "Barcelona" },
      { "@type": "Place", name: dest.name },
    ],
    offers: {
      "@type": "AggregateOffer",
      lowPrice: sedan,
      highPrice: mpv,
      priceCurrency: "EUR",
      offerCount: 3,
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Transfers", item: `${BASE}/transfers` },
      { "@type": "ListItem", position: 3, name: dest.name, item: `${BASE}/transfers/${dest.slug}` },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dest.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return { serviceSchema, breadcrumbSchema, faqSchema };
}

function typeLabel(type: string) {
  if (type === "hotel") return "Hotel Transfer";
  if (type === "cruise") return "Cruise Terminal Transfer";
  if (type === "event") return "Event Transfer";
  return "Long-Distance Transfer";
}

export default async function TransferSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dest = getDestination(slug);

  if (!dest) {
    return (
      <>
        <Navbar />
        <main className="pt-20 min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-4xl text-white mb-4">Destination not found</h1>
            <Link href="/transfers" className="text-gold-400 hover:text-gold-300">View all transfers</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // One resolution, from the same authority that quotes a booking.
  const prices = await getPlacePrices(dest.coordinates.lat, dest.coordinates.lng, dest.distance_km);
  const sedan  = prices?.economy ?? dest.prices.sedan;
  const isFixed = prices?.basis !== "distance";
  const { serviceSchema, breadcrumbSchema, faqSchema } = buildSchema(dest, prices);
  // "nearby" slugs can point either at a programmatic destinations.json entry or at one
  // of the hand-built static pages (girona, sitges, costa-brava, ...) — check both so a
  // valid reference never silently disappears from the related-destinations grid.
  const nearbyDests = dest.nearby
    .map((s) => destinations.find((d) => d.slug === s) ?? STATIC_TRANSFER_PAGES.find((d) => d.slug === s))
    .filter((d): d is Destination | (typeof STATIC_TRANSFER_PAGES)[number] => Boolean(d));

  // Nearby cards priced from the authority too. Programmatic entries carry
  // coordinates; the hand-built pages are looked up by their zone name.
  const nearbyPriced = await Promise.all(
    nearbyDests.map(async (n) => {
      const coords = (n as Destination).coordinates;
      const resolved = coords
        ? await getPlacePrices(coords.lat, coords.lng, n.distance_km)
        : SLUG_TO_ZONE[n.slug]
          ? await getDestinationPrices(SLUG_TO_ZONE[n.slug])
          : null;
      return { ...n, fromPrice: resolved?.economy ?? null };
    }),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Navbar />

      <main className="pt-20">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Breadcrumb */}
            <div className="flex justify-center items-center gap-2 mb-4 text-sm">
              <Link href="/transfers" className="text-dark-400 hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-600" />
              <span className="text-gold-400">{dest.name}</span>
            </div>

            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> {typeLabel(dest.type)}
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white mb-6 max-w-4xl mx-auto leading-tight">
              Barcelona Airport to{" "}
              <span className="text-gold-gradient">{dest.name}</span>{" "}
              Transfer
            </h1>

            <p className="text-dark-300 text-lg max-w-2xl mx-auto mb-8">
              Fixed-price private transfer from BCN El Prat Airport to {dest.name} ({dest.area}).{" "}
              {dest.distance_km} km — approximately {dest.duration_min} minutes. From{" "}
              <span className="text-gold-400 font-semibold">€{sedan}{isFixed ? " fixed" : ""}</span>.
              No surge pricing, ever.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white">
                <Clock size={16} className="text-gold-500" />
                {dest.duration_min} min
              </div>
              <div className="flex items-center gap-2 text-white">
                <MapPin size={16} className="text-gold-500" />
                {dest.distance_km} km
              </div>
              <div className="flex items-center gap-2 text-white">
                <Star size={16} className="text-gold-500" />
                from €{sedan}{isFixed ? " fixed" : ""}
              </div>
            </div>

            <Link
              href={`/book?destination=${encodeURIComponent(dest.name)}`}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Transfer — from €{sedan}
            </Link>
          </div>
        </section>

        {/* ── Why choose Élite BCN ─────────────────────────── */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your{" "}
              <span className="text-gold-gradient">{dest.name}</span> transfer
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: Shield,
                  title: isFixed ? `Fixed price — €${sedan}` : `From €${sedan}`,
                  body: "The price you see is the price you pay. No meter, no traffic surcharges, no airport supplements added at drop-off.",
                },
                {
                  icon: Clock,
                  title: "Meet & greet in arrivals",
                  body: "Your driver waits in the BCN Airport arrivals hall with your name on a board. 60 minutes free waiting from your actual flight landing.",
                },
                {
                  icon: Star,
                  title: "Real-time flight tracking",
                  body: "We monitor your flight live. If it delays, your driver adjusts automatically with no extra charge.",
                },
                {
                  icon: CheckCircle2,
                  title: "Premium vehicles",
                  body: "Mercedes V-Class (7 pax), EQE 300 Electric & Vito (8 pax). Air-conditioned, water on board, child seats on request.",
                },
                {
                  icon: MapPin,
                  title: "Door-to-door service",
                  body: `Dropped directly at ${dest.name}. No sharing, no stops, no detours — pure point-to-point comfort.`,
                },
                {
                  icon: Shield,
                  title: "Licensed VTC operator",
                  body: "Fully licensed under Generalitat de Catalunya VTC regulations. Professional chauffeurs, fully insured.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <Icon size={24} className="text-gold-500 mb-3" />
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About destination ──────────────────────────── */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              About <span className="text-gold-gradient">{dest.name}</span>
            </h2>
            <p className="text-dark-300 leading-relaxed text-lg mb-6">{dest.description}</p>
            {dest.highlights && dest.highlights.length > 0 && (
              <ul className="space-y-2">
                {dest.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-3 text-dark-300">
                    <CheckCircle2 size={16} className="text-gold-500 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Vehicle pricing table ──────────────────────── */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              {dest.name} Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4">Passengers</th>
                    <th className="text-right text-dark-400 font-medium p-4">{isFixed ? "Fixed Price" : "Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Each vehicle at its own price column. The EQE is a
                      business-class car and the V-Class its own class again —
                      quoting both at the cheaper column advertised less than
                      the booking would charge. */}
                  {[
                    { vehicle: "Mercedes EQE 300 Electric", pax: "1–4", price: prices?.business },
                    { vehicle: "Mercedes Vito (8 pax)",     pax: "1–8", price: prices?.minivan  },
                    { vehicle: "Mercedes V-Class (7 pax)",  pax: "1–7", price: prices?.vclass   },
                  ].map((row) => (
                    <tr key={row.vehicle} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-white">{row.vehicle}</td>
                      <td className="p-4 text-dark-400">{row.pax} pax</td>
                      <td className="p-4 text-right">
                        <span className="text-gold-400 font-semibold text-base">{row.price != null ? `€${row.price}` : "On request"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">
              Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Includes meet & greet in arrivals, 60 min free waiting, and luggage handling.
            </p>
            <div className="mt-6 text-center">
              <Link
                href={`/book?destination=${encodeURIComponent(dest.name)}`}
                className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-8 py-3 rounded-lg transition-colors"
              >
                Book Now — from €{sedan}
              </Link>
            </div>
          </div>
        </section>

        {/* ── Google Maps embed ──────────────────────────── */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-2xl text-white text-center mb-6">
              Location — <span className="text-gold-gradient">{dest.name}</span>
            </h2>
            <div className="rounded-xl overflow-hidden border border-white/[0.08]" style={{ height: 360 }}>
              <iframe
                title={`Map of ${dest.name}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${dest.coordinates.lat},${dest.coordinates.lng}&z=14&output=embed`}
              />
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────── */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </h2>
            <div className="space-y-4">
              {dest.faqs.map((faq, i) => (
                <div key={i} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-3 text-base">{faq.q}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Related destinations ───────────────────────── */}
        {nearbyDests.length > 0 && (
          <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="font-display text-2xl text-white text-center mb-8">
                Related <span className="text-gold-gradient">Transfers</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {nearbyPriced.map((nearby) => (
                  <Link
                    key={nearby.slug}
                    href={`/transfers/${nearby.slug}`}
                    className="bg-dark-900 border border-white/[0.08] rounded-xl p-5 hover:border-gold-500/30 transition-colors group"
                  >
                    <p className="text-xs text-gold-500 uppercase tracking-widest mb-1">{typeLabel(nearby.type)}</p>
                    <h3 className="text-white font-semibold group-hover:text-gold-400 transition-colors mb-1">{nearby.name}</h3>
                    <p className="text-dark-400 text-sm">{nearby.distance_km} km{nearby.fromPrice !== null ? ` · from €${nearby.fromPrice}` : ""}</p>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link href="/transfers" className="text-gold-400 hover:text-gold-300 text-sm tracking-wide">
                  View all destinations →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA ─────────────────────────────────── */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">
              Ready to book your {dest.name} transfer?
            </h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href={`/book?destination=${encodeURIComponent(dest.name)}`}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Now — from €{sedan}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
