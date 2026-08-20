import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";

const andorraLadder = ladderFor("andorra", "airport")!;

const andorraPrice =
  ROUTES.find((r) => r.from === "barcelona_city" && r.to === "andorra")?.economy ?? 285;

export const metadata: Metadata = {
  title: { absolute: "Barcelona Airport to Andorra Private Transfer | Elite BCN" },
  description:
    "Fixed €300 per car, Barcelona Airport to Andorra la Vella. Room for skis and boot bags, and we track your flight so a delay costs you nothing.",
  alternates: { canonical: "https://www.elitebcn.info/transfers/andorra" },
  // Encamp (87 impressions, position 48.8) and the return leg (22) had no owner
  // anywhere on the site. Both are served by this page's fixed fare and are now
  // covered in its content, so it claims them here too.
  keywords: ["barcelona andorra transfer", "barcelona andorra private car", "andorra ski transfer barcelona", "andorra la vella transfer", "barcelona to encamp transfer", "andorra to barcelona transfer"],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Andorra Transfer — from €${andorraPrice} | Fixed Price`,
    description: `Private transfer from Barcelona to Andorra la Vella from €${andorraPrice}. Fixed price, no surge pricing. Ski season specialist.`,
    url: "https://www.elitebcn.info/transfers/andorra",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to Andorra Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Andorra Transfer — from €${andorraPrice} | Fixed Price`,
    description: `Private transfer Barcelona to Andorra la Vella from €${andorraPrice}. Fixed price, no surge pricing. Ski season specialist.`,
    images: ["/opengraph-image"],
  },
};

const andorraServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Andorra Private Transfer",
  description: `Fixed-price private transfer from Barcelona Airport to Andorra la Vella. From €${andorraPrice}. 3-hour Pyrenean journey. Ski season and shopping specialist.`,
  url: "https://www.elitebcn.info/transfers/andorra",
  provider: { "@type": "LocalBusiness", name: "Elite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Andorra la Vella, Andorra",
  offers: { "@type": "Offer", price: String(andorraPrice), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",      item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Transfers", item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Andorra",   item: "https://www.elitebcn.info/transfers/andorra" },
  ],
};

export default function AndorraTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(andorraServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-500 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Andorra</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona city or airport → Andorra
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Andorra Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private transfer to Andorra la Vella from BCN El Prat Airport or anywhere in Barcelona city —
              the same fixed fare either way.
              Fixed price €{andorraPrice} — no meter, no tolls surprise, no surge pricing.
              We also serve the ski stations at Grandvalira and Vallnord, which are further up
              the valley and quoted by distance.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> ~3 hours</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 210 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{andorraPrice} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Andorra Transfer — €{andorraPrice}
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why choose Elite BCN for your <span className="text-gold-gradient">Andorra transfer</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${andorraPrice}`, body: `One fixed price covers the full 210 km journey to Andorra la Vella and the mountain road sections. The ski stations sit further up the valley and are quoted by distance. VAT and tolls are charged separately.` },
                { icon: Clock, title: "Ski equipment transport", body: "Large boot space for ski bags, boot bags, and suitcases. The V-Class handles full ski kit for 4+ people." },
                { icon: Star, title: "Winter mountain driving", body: "Our drivers are experienced in Pyrenean mountain routes year-round, including winter conditions." },
                { icon: CheckCircle2, title: "Grandvalira ski station", body: "Direct drop-off at Grandvalira (Europe's largest ski area), Vallnord, or your Andorran hotel." },
                { icon: MapPin, title: "Duty-free shopping trips", body: "Use us for day-trip shopping in Andorra la Vella — we can wait and return you to Barcelona." },
                { icon: Shield, title: "No airport, no railway", body: "Andorra has neither, so every arrival comes by road. Scheduled coaches run to a fixed timetable from a fixed stop; a private car leaves when you land and stops at your door." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Andorra</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Andorra is a tiny landlocked principality nestled in the Pyrenees between Spain and France.
                At just 468 km², it&apos;s one of Europe&apos;s smallest countries — yet it attracts over 8 million visitors
                annually thanks to its <strong className="text-white">duty-free shopping</strong>, <strong className="text-white">world-class skiing</strong>,
                and <strong className="text-white">spectacular mountain scenery</strong>.
              </p>
              <p>
                <strong className="text-white">Grandvalira</strong> is the Pyrenees&apos; largest ski area, with 210 km of pistes across 6 sectors.
                The capital <strong className="text-white">Andorra la Vella</strong> is Europe&apos;s highest capital city at 1,023 m,
                and is packed with tax-free shops for electronics, perfume, alcohol, and tobacco.
              </p>
              <p>
                Andorra has no airport and no railway, so every arrival comes by road. Scheduled coaches run from
                Barcelona to Andorra on a fixed timetable from a fixed stop, which works well if your flight lands
                near a departure and less well if it does not. A private transfer leaves when you land, from the
                arrivals hall, and stops at your own door.
              </p>
              <p>
                The road runs up through Lleida and the Segre valley to{" "}
                <strong className="text-white">La Seu d&apos;Urgell</strong>, the last Spanish town before the
                border and a stop we are often asked for in its own right — either as the destination, or as a
                halt on the way up. Ask when you book and we will price it; it sits outside the Andorra fare and
                is quoted by distance.
              </p>
            </div>
          </div>
        </section>

        {/* Named destinations. Encamp in particular: it is the second most
            searched Andorra term reaching this site and had no content at all,
            while sharing the Andorra fare exactly. A section here beats a
            separate page that would duplicate this one's price and route. */}
        <section className="py-16 bg-dark-950 border-b border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Where in Andorra <span className="text-gold-gradient">we drive</span>
            </h2>
            <p className="text-dark-300 leading-relaxed mb-8">
              The parishes below are all covered by the same fixed fare of €{andorraPrice} for an economy
              sedan. Andorra is small and the road up the valley serves all of them, so where you are
              staying inside the country does not change what you pay.
            </p>

            <div className="space-y-6">
              {[
                {
                  name: "Andorra la Vella",
                  body: "The capital, and where most first visits stay. Europe's highest capital city at 1,023 m, and the centre of the duty-free shopping that brings a good share of Andorra's visitors. Drop-off at your hotel door on Meritxell or Carlemany rather than at a coach stop with your luggage.",
                },
                {
                  name: "Encamp",
                  body: "Ten minutes further up the CG-2 from the capital, and the parish that reaches all the way to the French border. Encamp is where many winter visitors actually sleep: rooms cost less than in Soldeu or Pas de la Casa, and the Funicamp gondola climbs straight from the town into the Grandvalira ski area, so you can stay in the valley and still be on the snow early. The same fixed fare applies as to the capital.",
                },
                {
                  name: "Canillo, La Massana, Ordino, Sant Julià de Lòria",
                  body: "The remaining parishes are served at the same price. Tell us the hotel or apartment address when you book and the driver takes you to it.",
                },
                {
                  name: "The ski stations",
                  body: "Grandvalira and its sectors — Soldeu, El Tarter, Pas de la Casa, Grau Roig — and the Vallnord stations at Arinsal, Pal and Ordino-Arcalís all sit above the towns, further than the parish villages and on mountain roads. They are quoted by distance rather than at the Andorra fare, so ask us and we will confirm the price before you book.",
                },
              ].map(({ name, body }) => (
                <div key={name} className="border-l-2 border-gold-500/30 pl-5">
                  <h3 className="text-white font-medium mb-1.5">{name}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Serves the "andorra airport shuttle" searches without ever claiming
            to run one. The underlying need is transport from BCN to Andorra;
            what we sell is the private alternative, and the copy says so. */}
        <section className="py-16 bg-[#050505] border-b border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Private car, <span className="text-gold-gradient">not a shared shuttle</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                People searching for an airport shuttle to Andorra are usually looking for one thing: a way to
                get from the terminal to their hotel without hiring a car and driving a mountain pass after a
                flight. We are not that shuttle. Elite BCN runs <strong className="text-white">private
                transfers only</strong> — the car is booked for your party alone, with no other passengers,
                no other stops, and no seat-by-seat pricing.
              </p>
              <p>
                What that changes in practice: the car leaves when you are ready rather than at a published
                departure time, the price is per vehicle so a family of four pays once rather than four times,
                and the ski bags and suitcases go in the boot of the car you booked instead of competing for
                space with strangers&apos; luggage.
              </p>
              <p>
                The return works the same way. <strong className="text-white">Andorra to Barcelona Airport</strong> is
                the same fixed fare in reverse, and we will set the pickup against your flight time so you are
                not standing outside a hotel at dawn guessing how long the descent takes.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Andorra Transfer <span className="text-gold-gradient">Prices</span></h2>
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
                    { route: "BCN Airport → Andorra la Vella (sedan)", price: `€${andorraPrice}` },
                    { route: "BCN Airport → Andorra la Vella (MPV, 7 seats)", price: `€${andorraLadder.minivan}` },
                    // The ski stations are charged as destinations outside
                    // Andorra, not at the Andorra fare. They are priced by road
                    // distance, so the exact figure depends on which station and
                    // comes from the quote at booking — quoting one number here
                    // would be the same mistake that had them advertised at €240.
                    { route: "BCN Airport → Grandvalira ski resort", price: "Quoted by distance" },
                    { route: "BCN Airport → Vallnord ski resort", price: "Quoted by distance" },
                    { route: "Andorra la Vella → BCN Airport", price: `€${andorraPrice}` },
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
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Andorra transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{andorraPrice}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
