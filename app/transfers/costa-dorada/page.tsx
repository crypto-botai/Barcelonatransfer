import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import { cheapestOf } from "@/lib/destination-pricing";

// The region has no single route in the table; the headline is the
// cheapest of the destinations this page actually names.
const COSTA_DORADA_FROM = cheapestOf(["castelldefels", "sitges", "cubelles", "calafell", "vendrell", "tarragona", "la_pineda", "salou", "portaventura", "cambrils"])!;


const COSTA_DORADA = ROUTES.filter((r) => r.category === "costa-dorada");

export const metadata: Metadata = {
  title: `Barcelona to Costa Dorada Transfer — from €${COSTA_DORADA_FROM} | Élite BCN`,
  description: `Private transfer from Barcelona to Costa Dorada. Sitges, Tarragona, Salou, PortAventura, Cambrils. Fixed prices from €${COSTA_DORADA_FROM}. All vehicle classes. Book instantly.`,
  alternates: { canonical: "https://www.elitebcn.info/transfers/costa-dorada" },
  keywords: ["barcelona costa dorada transfer", "airport salou transfer", "barcelona portaventura transfer", "salou private transfer"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Costa Dorada Transfer — from €${COSTA_DORADA_FROM} | Fixed Price`,
    description: `Private transfer from Barcelona to Costa Dorada from €${COSTA_DORADA_FROM}. Sitges, Tarragona, Salou, PortAventura. Fixed price, all vehicles.`,
    url: "https://www.elitebcn.info/transfers/costa-dorada",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona to Costa Dorada Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Costa Dorada Transfer — from €${COSTA_DORADA_FROM} | Élite BCN`,
    description: `Private transfer from Barcelona to Costa Dorada from €${COSTA_DORADA_FROM}. Sitges, Salou, PortAventura. Fixed price, all vehicles.`,
    images: ["/opengraph-image"],
  },
};

const costadoradaSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Costa Dorada Private Transfer",
  description: "Luxury fixed-price private transfers from Barcelona to all Costa Dorada resorts — Sitges, Tarragona, Salou, PortAventura, Cambrils and beyond.",
  url: "https://www.elitebcn.info/transfers/costa-dorada",
  provider: { "@type": "LocalBusiness", name: "Élite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Costa Dorada, Catalonia, Spain",
  offers: { "@type": "Offer", price: String(COSTA_DORADA_FROM), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const costadoradaBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",          item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Destinations",  item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Costa Dorada",  item: "https://www.elitebcn.info/transfers/costa-dorada" },
  ],
};

export default function CostaDoradaTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(costadoradaSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(costadoradaBreadcrumb) }} />
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-600 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Costa Dorada</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Costa Dorada
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Costa Dorada Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfers from Barcelona to the Costa Dorada.
              Castelldefels, Sitges, Tarragona, Salou, PortAventura, Cambrils — fixed prices per vehicle, excl. VAT and tolls, all vehicle classes.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 20 min – 2 hrs</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 20–170 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{COSTA_DORADA_FROM} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Costa Dorada Transfer
            </Link>
          </div>
        </section>

        {/* Full price table */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              Costa Dorada <span className="text-gold-gradient">Transfer Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Destination</th>
                    <th className="text-center text-dark-400 font-medium p-3">Sedan<br /><span className="text-dark-600 font-normal text-xs">1–3 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Business<br /><span className="text-dark-600 font-normal text-xs">1–3 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Minivan<br /><span className="text-dark-600 font-normal text-xs">4–8 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3 text-gold-400">V-Class<br /><span className="text-dark-600 font-normal text-xs">7 pax</span></th>
                    <th className="text-center text-dark-400 font-medium p-3">Minibus<br /><span className="text-dark-600 font-normal text-xs">9+ pax</span></th>
                  </tr>
                </thead>
                <tbody>
                  {COSTA_DORADA.map((r) => (
                    <tr key={r.to} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-white font-medium">{r.label.replace("Barcelona ⇄ ", "")}</td>
                      <td className="p-3 text-center text-white">€{r.economy}</td>
                      <td className="p-3 text-center text-white">€{r.business}</td>
                      <td className="p-3 text-center text-white">€{r.minivan}</td>
                      <td className="p-3 text-center text-gold-400 font-semibold">€{r.vclass}</td>
                      <td className="p-3 text-center text-white">€{r.minibus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">
              Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Includes meet &amp; greet. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Child seats free.
            </p>
          </div>
        </section>

        {/* About */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Costa Dorada</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                The Costa Dorada ("Golden Coast") stretches south of Barcelona from Castelldefels to Cambrils,
                named for its long sandy beaches with golden sand. It&apos;s one of Catalonia&apos;s most popular holiday regions.
              </p>
              <p>
                Key destinations include <strong className="text-white">Sitges</strong> (glamorous seaside town, 35 km from Barcelona),
                <strong className="text-white"> Tarragona</strong> (UNESCO Roman ruins and medieval cathedral),
                <strong className="text-white"> Salou &amp; La Pineda</strong> (resort beaches), and
                <strong className="text-white"> PortAventura World</strong> (Spain&apos;s #1 theme park).
              </p>
              <p>
                A private transfer is the most convenient way to reach these destinations from Barcelona, especially for families with luggage.
              </p>
            </div>
          </div>
        </section>

        {/* Why us */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Élite BCN for your <span className="text-gold-gradient">Costa Dorada transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Fixed transparent prices", body: "Fixed price per vehicle, excluding VAT and tolls. Fuel and driver included; 10% VAT applies only if you need an invoice." },
                { icon: Clock, title: "Direct door-to-door", body: "Straight to your hotel, resort, or theme park entrance — no stops, no shared rides." },
                { icon: Star, title: "All vehicle classes", body: "Sedan, Business, Minivan (Vito), V-Class VIP, or Minibus — choose what fits your group." },
                { icon: CheckCircle2, title: "Family-friendly", body: "Child and baby seats on request, €5 per seat. Ideal for families flying in with young children." },
                { icon: MapPin, title: "PortAventura specialists", body: "Drop at any PortAventura entrance, Ferrari Land, or resort hotel on the Costa Dorada." },
                { icon: Shield, title: "24/7 availability", body: "Early morning flights, late-night arrivals — we operate every hour of every day, 365 days." },
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

        {/* Related destinations */}
        <section className="py-12 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <p className="text-dark-500 text-xs mb-4">Popular Costa Dorada destinations</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Sitges", "Tarragona", "Salou", "PortAventura", "Cambrils", "La Pineda", "Castelldefels"].map((d) => (
                <span key={d} className="text-sm px-4 py-2 rounded-full border border-white/[0.08] bg-dark-900 text-dark-300">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Costa Dorada transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{COSTA_DORADA_FROM}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
