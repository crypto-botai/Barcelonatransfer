import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

const airportPrice = ROUTES.find((r) => r.from === "airport" && r.to === "montserrat")?.economy ?? 85;
const cityPrice    = ROUTES.find((r) => r.from === "barcelona_city" && r.to === "montserrat")?.economy ?? 115;
const mpvPrice     = ROUTES.find((r) => r.from === "airport" && r.to === "montserrat")?.minivan ?? 105;

export const metadata: Metadata = {
  title: { absolute: `Barcelona Airport to Montserrat — from €${airportPrice}` },
  description: `Private transfer from Barcelona Airport to Montserrat monastery. Fixed price from €${airportPrice}. 50-minute journey. Meet & greet, no surge pricing. Book instantly.`,
  alternates: { canonical: "https://www.elitebcn.info/transfers/montserrat" },
  keywords: ["barcelona airport montserrat transfer", "montserrat private transfer", "montserrat day trip barcelona", "barcelona montserrat tour transfer"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona Airport to Montserrat Transfer — from €${airportPrice} | Fixed Price`,
    description: `Private transfer Barcelona Airport to Montserrat from €${airportPrice}. Fixed price, no surge pricing. 50-minute journey.`,
    url: "https://www.elitebcn.info/transfers/montserrat",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to Montserrat Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona Airport to Montserrat — from €${airportPrice} | Elite BCN`,
    description: `Private transfer Barcelona Airport to Montserrat monastery from €${airportPrice}. Fixed price, no surge pricing.`,
    images: ["/opengraph-image"],
  },
};

const montserratSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona Airport to Montserrat Transfer",
  description: `Fixed-price private transfer from Barcelona Airport (BCN El Prat) to Montserrat monastery. From €${airportPrice}. 50-minute journey.`,
  url: "https://www.elitebcn.info/transfers/montserrat",
  provider: { "@type": "LocalBusiness", name: "Elite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Montserrat, Catalonia, Spain",
  offers: { "@type": "Offer", price: String(airportPrice), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const montserratBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",         item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Montserrat",   item: "https://www.elitebcn.info/transfers/montserrat" },
  ],
};

export default function MontserratTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(montserratSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(montserratBreadcrumb) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-500 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Montserrat</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Montserrat
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Airport to <br /><span className="text-gold-gradient">Montserrat Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private luxury transfer from BCN El Prat Airport direct to Montserrat monastery.
              Fixed price from €{airportPrice}, no surge pricing, no stress.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> 50 minutes</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 50 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{airportPrice} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Montserrat Transfer — €{airportPrice}
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">Montserrat transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${airportPrice}`, body: `Price includes the mountain roads, no meter, no surprises. Drop at the monastery parking or Aeri cable car station.` },
                { icon: Clock, title: "Day-trip return included", body: "Book a return transfer for your chosen time. We wait while you explore — hourly waiting rate applies after 60 min." },
                { icon: Star, title: "Direct from airport", body: "Start your Montserrat visit directly from the airport without going into Barcelona first." },
                { icon: CheckCircle2, title: "Monastery access points", body: "Drop at the main monastery plaza, Aeri cable car base, or rack railway (Cremallera) station at Monistrol." },
                { icon: MapPin, title: "Barcelona city pickup too", body: "Prefer to start from your Barcelona hotel? We offer pickup from any city address." },
                { icon: Shield, title: "Child seats available", body: "Baby seats and child booster seats available on request, €5 per seat." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Montserrat</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Montserrat — meaning "serrated mountain" — is Catalonia's most sacred site and one of Spain's most visited destinations.
                The striking multi-peaked mountain rises dramatically from the plains 50 km northwest of Barcelona,
                home to a 9th-century Benedictine monastery and the revered <strong className="text-white">Black Madonna (La Moreneta)</strong>.
              </p>
              <p>
                Over a million pilgrims and tourists visit each year to venerate the Black Madonna, watch the famous
                <strong className="text-white"> Escolania boys' choir</strong> (one of Europe's oldest), and hike the network of mountain trails
                with panoramic views over Catalonia.
              </p>
              <p>
                A private transfer from Barcelona Airport is the most comfortable option — arriving directly at the monastery
                without navigating train connections to Manresa or Monistrol de Montserrat.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Montserrat Transfer <span className="text-gold-gradient">Prices</span></h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Route</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { route: "BCN Airport → Montserrat (sedan)", price: `€${airportPrice}` },
                    { route: "BCN Airport → Montserrat (MPV, 7 seats)", price: `€${mpvPrice}` },
                    { route: "Barcelona City → Montserrat (sedan)", price: `€${cityPrice}` },
                    { route: "Montserrat → BCN Airport", price: `€${airportPrice}` },
                  ].map((row) => (
                    <tr key={row.route} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet & greet, child seats and other extras are optional and charged separately.</p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Montserrat transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{airportPrice}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
