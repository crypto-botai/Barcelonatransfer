import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";
import RouteFaqs from "@/components/transfers/RouteFaqs";
import { ROUTE_FAQ_SPECS } from "@/lib/route-faqs";

const LADDER = ladderFor("portaventura", "airport")!;

const PA = ROUTES.find((r) => r.to === "portaventura")!;

export const metadata: Metadata = {
  title: { absolute: "Barcelona to PortAventura Transfer — from €155" },
  description:
    "Fixed €155 per vehicle to PortAventura World, door to door. The price covers the whole car rather than each seat, so a family pays once.",
  alternates: { canonical: "https://www.elitebcn.info/transfers/port-aventura" },
  keywords: ["barcelona portaventura transfer", "portaventura theme park transfer", "barcelona portaventura world private transfer", "salou portaventura taxi"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona to PortAventura Transfer — from €155 | Fixed Price",
    description: "Private transfer from Barcelona to PortAventura World from €155. Fixed price, family-friendly, all vehicle classes.",
    url: "https://www.elitebcn.info/transfers/port-aventura",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to PortAventura Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona to PortAventura Transfer — from €155 | Fixed Price",
    description: "Private transfer from Barcelona to PortAventura World from €155. Fixed price, family-friendly.",
    images: ["/opengraph-image"],
  },
};

const paSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to PortAventura World Transfer",
  description: "Fixed-price private transfer from Barcelona to PortAventura World, Ferrari Land and Caribe Aquatic Park. From €155 economy to €275 minibus.",
  url: "https://www.elitebcn.info/transfers/port-aventura",
  provider: { "@id": "https://www.elitebcn.info/#business" },
  areaServed: "PortAventura, Salou, Tarragona, Spain",
  offers: { "@type": "Offer", price: String(LADDER.economy), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const paBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",            item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Destinations",    item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "PortAventura",    item: "https://www.elitebcn.info/transfers/port-aventura" },
  ],
};

export default function PortAventuraTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(paSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(paBreadcrumb) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-500 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">PortAventura</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → PortAventura World
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">PortAventura Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from Barcelona directly to PortAventura World, Ferrari Land, or your Costa Daurada hotel.
              fixed price (excl. VAT & tolls) from €{PA.economy} — ideal for families.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 70 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 95 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{PA.economy} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book PortAventura Transfer — €{PA.economy}
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">PortAventura transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed price from €155", body: "Single fixed price per vehicle, excluding VAT and tolls. No meter running, no extra charge for luggage." },
                { icon: CheckCircle2, title: "Child seats available", body: "Baby and booster seats on request, €5 per seat — essential for families flying in with young children." },
                { icon: Star, title: "Direct to theme park gate", body: "Drop-off at PortAventura main entrance, Ferrari Land entrance, or your on-site hotel lobby." },
                { icon: Clock, title: "Meet & greet in arrivals", body: "Driver waits with your name board in the arrivals hall. 60 minutes free waiting from your flight landing." },
                { icon: MapPin, title: "All Costa Daurada hotels", body: "We drop at any resort hotel in Salou, Cambrils, La Pineda, or Vila-seca on the same journey." },
                { icon: Shield, title: "7-seat MPV for families", body: "The Mercedes V-Class comfortably fits 2 adults + children with prams, luggage, and child seats." },
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

        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">PortAventura World</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                PortAventura World is Spain&apos;s #1 theme park resort and the 4th most visited in Europe,
                located 95 km southwest of Barcelona near the town of Salou on the Costa Daurada.
              </p>
              <p>
                The resort comprises three parks: <strong className="text-white">PortAventura Theme Park</strong> (6 themed worlds including Polynesia, Far West, China, Mexico, and SésamoAventura),
                <strong className="text-white"> Ferrari Land</strong> (Europe&apos;s only Ferrari theme park), and
                <strong className="text-white"> Caribe Aquatic Park</strong> (open summer season).
              </p>
              <p>
                The journey by private transfer takes approximately 70 minutes via the AP-7 motorway — compared to 1.5–2 hours by a combination of train and shuttle bus, which is impractical with family luggage.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">PortAventura Transfer <span className="text-gold-gradient">Prices</span></h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4">Capacity</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price (VAT incl.)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Sedan (Economy)",    pax: "1–3 pax", price: PA.economy  },
                    { label: "Business Sedan",     pax: "1–3 pax", price: PA.business },
                    { label: "Minivan (Vito)",     pax: "4–8 pax", price: PA.minivan  },
                    { label: "V-Class VIP",        pax: "7 pax",   price: PA.vclass   },
                    { label: "Minibus",            pax: "9+ pax",  price: PA.minibus  },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                      <td className="p-4 text-white">{row.label}</td>
                      <td className="p-4 text-dark-400">{row.pax}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">€{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet &amp; greet, child seats and other extras are optional and charged separately.</p>
          </div>
        </section>

        {/* The questions people ask before booking this route. The page
            stopped at the price table and answered none of them. */}
        <RouteFaqs spec={ROUTE_FAQ_SPECS["port-aventura"]} />

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your PortAventura transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{PA.economy}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
