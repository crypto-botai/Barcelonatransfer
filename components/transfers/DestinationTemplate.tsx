import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { lookupFixedPriceByZone } from "@/lib/pricing";
import { BASE_URL, breadcrumbSchema } from "@/lib/seo";

export interface DestinationSpec {
  slug:        string;
  name:        string;
  /** Zone key from lib/pricing — every price on the page is derived from it. */
  zone:        string;
  areaServed:  string;
  distanceKm:  number;
  durationText: string;
  intro:       string;
  /** Longer "about" copy, one paragraph per entry. */
  about:       string[];
  highlights:  string[];
  faqs:        { q: string; a: string }[];
  nearby:      { name: string; href: string; blurb: string }[];
  /** Optional related long-form guide on the blog. */
  guideHref?:  string;
}

const CLASSES = [
  { code: "ECONOMY",  label: "Economy sedan (Corolla)",             pax: "1–3" },
  { code: "BUSINESS", label: "Business sedan (EQE 300 / Tesla M3)", pax: "1–3" },
  { code: "MINIVAN",  label: "Minivan (Vito)",                      pax: "1–8" },
  { code: "VCLASS",   label: "V-Class",                             pax: "1–7" },
  { code: "MINIBUS",  label: "Minibus (Sprinter)",                  pax: "9–16" },
] as const;

export function destinationSchemas(d: DestinationSpec, fromPrice: number | null) {
  const url = `${BASE_URL}/transfers/${d.slug}`;
  return {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Barcelona to ${d.name} Private Transfer`,
      description: d.intro,
      url,
      provider: { "@type": "LocalBusiness", name: "Elite BCN Transfers", url: BASE_URL, telephone: "+34635383712" },
      areaServed: [{ "@type": "City", name: "Barcelona" }, { "@type": "Place", name: d.areaServed }],
      ...(fromPrice ? { offers: { "@type": "Offer", price: String(fromPrice), priceCurrency: "EUR", availability: "https://schema.org/InStock" } } : {}),
    },
    breadcrumb: breadcrumbSchema([
      { name: "Home",      url: BASE_URL },
      { name: "Transfers", url: `${BASE_URL}/transfers` },
      { name: d.name,      url },
    ]),
    faq: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: d.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  };
}

export default function DestinationTemplate({ d }: { d: DestinationSpec }) {
  // Every price on the page comes from the live fixed-price matrix.
  const prices = CLASSES.map((c) => ({ ...c, price: lookupFixedPriceByZone("airport", d.zone, c.code) }));
  const fromPrice = prices[0].price;
  const { service, breadcrumb, faq } = destinationSchemas(d, fromPrice);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <Navbar />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-500 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">{d.name}</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona ⇄ {d.name}
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">{d.name} Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">{d.intro}</p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> {d.durationText}</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> {d.distanceKm} km</div>
              {fromPrice && <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{fromPrice} fixed</div>}
            </div>
            <Link
              href={`/book?destination=${encodeURIComponent(d.name)}`}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book {d.name} Transfer{fromPrice ? ` — €${fromPrice}` : ""}
            </Link>
          </div>
        </section>

        {/* Why book */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">{d.name} transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: fromPrice ? `Fixed price from €${fromPrice}` : "Fixed price", body: "Agreed before you travel. No meter, no traffic surcharges. VAT and tolls are charged separately." },
                { icon: Clock, title: "Where your driver waits", body: "At the designated meeting point outside, next to the taxi rank where reserved VTC cars may park. 60 minutes free waiting from your flight landing. A name board inside arrivals is a €5 extra." },
                { icon: Star, title: "Real-time flight tracking", body: "We monitor your flight live. If it's delayed, your driver adjusts automatically — no extra charge." },
                { icon: CheckCircle2, title: "Premium vehicles", body: "Mercedes V-Class, EQE 300 Electric and Vito. Air-conditioned, bottled water, WiFi on request." },
                { icon: MapPin, title: "Door-to-door service", body: `Dropped directly at your ${d.name} hotel, villa or address. No sharing, no stops, no detours.` },
                { icon: Shield, title: "Licensed VTC operator", body: "Fully licensed VTC under Generalitat de Catalunya regulations, with full passenger insurance." },
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

        {/* About */}
        <section className="py-16 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">{d.name}</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              {d.about.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {d.highlights.map((item) => (
                <div key={item} className="bg-dark-900 border border-white/[0.08] rounded-lg p-3 text-center">
                  <span className="text-dark-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            {d.guideHref && (
              <div className="mt-8 text-center">
                <Link href={d.guideHref} className="inline-flex items-center gap-2 text-gold-400 hover:text-gold-300 text-sm font-semibold">
                  Read our full {d.name} guide <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Prices */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">
              {d.name} Transfer <span className="text-gold-gradient">Prices</span>
            </h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4">Passengers</th>
                    <th className="text-right text-dark-400 font-medium p-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((row) => (
                    <tr key={row.code} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.label}</td>
                      <td className="p-4 text-dark-400">{row.pax} pax</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price ? `€${row.price}` : "On request"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-400 text-xs text-center mt-4">
              Fixed price per vehicle, excl. VAT and tolls. 10% VAT is added only if you request an invoice; motorway tolls are charged separately. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Meet &amp; greet, child seats and other extras are optional and charged separately.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              {d.name} Transfer <span className="text-gold-gradient">FAQs</span>
            </h2>
            <div className="space-y-4">
              {d.faqs.map((f) => (
                <div key={f.q} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-3 text-base">{f.q}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nearby */}
        <section className="py-16 bg-dark-950 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-2xl text-white text-center mb-8">
              Related <span className="text-gold-gradient">Transfers</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {d.nearby.map((n) => (
                <Link key={n.href} href={n.href} className="bg-dark-900 border border-white/[0.08] rounded-xl p-5 hover:border-gold-500/30 transition-colors group">
                  <h3 className="text-white font-semibold group-hover:text-gold-400 transition-colors mb-1">{n.name}</h3>
                  <p className="text-dark-400 text-sm">{n.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your {d.name} transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link
              href={`/book?destination=${encodeURIComponent(d.name)}`}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors"
            >
              Book Now{fromPrice ? ` — from €${fromPrice}` : ""}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
