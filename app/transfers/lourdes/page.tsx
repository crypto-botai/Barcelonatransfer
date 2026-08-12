import type { Metadata } from "next";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MapPin, Clock, Shield, Star, CheckCircle2, ChevronRight, Accessibility, Users } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";
import { ladderFor } from "@/lib/destination-pricing";

// Read from the price table, never restated. A repriced route reaches
// this page, its schema and the checkout together, or reaches none.
const LADDER = ladderFor("lourdes", "airport")!;


const lourdesPrice =
  ROUTES.find((r) => r.from === "airport" && r.to === "lourdes")?.economy ?? 750;

const URL = "https://www.elitebcn.info/transfers/lourdes";
const PHOTO = "/blog/lourdes-pilgrimage-transfer.jpg";

export const metadata: Metadata = {
  title: `Barcelona to Lourdes Transfer — from €${lourdesPrice} | Private Car`,
  description:
    `Private transfer Barcelona to Lourdes sanctuary, France. Fixed price from €${lourdesPrice} per vehicle. Direct 415 km door-to-door, no changes. Wheelchair accessible options and group minibus for parish pilgrimages.`,
  alternates: { canonical: URL },
  keywords: [
    "barcelona to lourdes transfer",
    "barcelona lourdes private transfer",
    "barcelona airport to lourdes taxi",
    "lourdes pilgrimage transfer from barcelona",
    "private car barcelona to lourdes france",
    "lourdes sanctuary transfer",
    "barcelona to lourdes by car",
    "group pilgrimage transfer lourdes",
    "wheelchair accessible transfer lourdes",
  ],
  openGraph: {
    ...SHARED_OG,
    title: `Barcelona to Lourdes Transfer — from €${lourdesPrice} | Private Car`,
    description: `Private door-to-door transfer from Barcelona to the Sanctuary of Our Lady of Lourdes. Fixed price from €${lourdesPrice}. Accessible vehicles and group minibus available.`,
    url: URL,
    images: [{ url: PHOTO, width: 1920, height: 1350, alt: "Basilica of Our Lady of the Rosary, Sanctuary of Lourdes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Barcelona to Lourdes Transfer — from €${lourdesPrice} | Private Car`,
    description: `Private transfer Barcelona to Lourdes from €${lourdesPrice}. Direct, fixed price, accessible vehicles available.`,
    images: [PHOTO],
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Barcelona to Lourdes Private Transfer",
  description: `Fixed-price private transfer from Barcelona and BCN El Prat Airport to the Sanctuary of Our Lady of Lourdes, France. From €${lourdesPrice} per vehicle. 415 km, approximately 6 hours.`,
  url: URL,
  provider: { "@type": "LocalBusiness", name: "Élite BCN Transfers", url: "https://www.elitebcn.info" },
  areaServed: "Lourdes, Hautes-Pyrénées, France",
  offers: { "@type": "Offer", price: String(lourdesPrice), priceCurrency: "EUR", availability: "https://schema.org/InStock" },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",      item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Transfers", item: "https://www.elitebcn.info/transfers" },
    { "@type": "ListItem", position: 3, name: "Lourdes",   item: URL },
  ],
};

/**
 * Questions people actually type before booking this route. Rendered as visible
 * text and as FAQPage schema from the same source, so the two can never drift.
 */
const FAQ = [
  {
    q: "How long does the transfer from Barcelona to Lourdes take?",
    a: "Around 6 hours of driving for the 415 km, using the AP-7 to the French border, then the A-61 past Toulouse and the A-64 to Tarbes. We build in a comfort stop; pilgrims travelling with reduced mobility or small children usually prefer two.",
  },
  {
    q: "Is there a direct train or flight from Barcelona to Lourdes?",
    a: "No. There is no direct flight, and the rail journey means changing at least twice — commonly Barcelona to Narbonne or Toulouse, then on to Lourdes — with a total journey time well beyond the drive. A private car goes door to door in one leg, which is why most parish groups choose it.",
  },
  {
    q: "Can you carry a wheelchair or a passenger with reduced mobility?",
    a: "Yes, and this route sees more such requests than any other we run. Tell us at booking what you are bringing — folding wheelchair, rollator, oxygen concentrator — and which vehicle suits, and we will confirm exactly what fits before you pay. We never guess on accessibility.",
  },
  {
    q: "Can you take a whole parish or pilgrimage group?",
    a: `Yes. The minibus seats up to 16 and is priced per vehicle, not per person, so a full group is far cheaper per head than the sedan fare of €${lourdesPrice}. For larger pilgrimages we can run several vehicles in convoy arriving together.`,
  },
  {
    q: "Will the driver wait and bring us back to Barcelona?",
    a: "Yes. Many pilgrims book a return on the same day or stay one or two nights. Waiting and return legs are quoted individually because they depend on your timings — message us on WhatsApp with your dates and we will confirm a fixed total.",
  },
  {
    q: "What is included in the price?",
    a: `The fixed price of €${lourdesPrice} covers the whole vehicle for the journey, meet & greet, and 60 minutes of free waiting at the airport. Motorway tolls and 10% VAT are charged separately; VAT is added only if you request an invoice.`,
  },
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function LourdesTransferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="flex justify-center mb-4">
              <Link href="/transfers" className="text-dark-400 text-sm hover:text-gold-400 transition-colors">All Destinations</Link>
              <ChevronRight size={14} className="text-dark-600 mx-2 mt-0.5" />
              <span className="text-gold-400 text-sm">Lourdes</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 text-gold-400 text-xs tracking-[0.2em] uppercase font-medium mb-6">
              <MapPin size={12} /> Barcelona → Lourdes, France
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona to <br /><span className="text-gold-gradient">Lourdes Transfer</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Private door-to-door transfer from Barcelona or BCN El Prat Airport to the Sanctuary of
              Our Lady of Lourdes. Fixed price €{lourdesPrice} per vehicle — one car, one driver, no changes along the way.
            </p>

            <div className="max-w-4xl mx-auto mb-10">
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/[0.08]">
                <Image
                  src={PHOTO}
                  alt="The Basilica of Our Lady of the Rosary at the Sanctuary of Lourdes, France"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                />
              </div>
              {/* CC BY-SA requires the photographer be credited wherever the
                  image appears — same treatment as the blog destination photos. */}
              <p className="text-white/25 text-[11px] mt-2.5 text-right">
                Photo:{" "}
                <a
                  href="https://commons.wikimedia.org/wiki/File:2018_-_Basilique_Notre-Dame-du-Rosaire_de_Lourdes.jpg"
                  target="_blank" rel="noopener noreferrer nofollow"
                  className="hover:text-white/45 underline underline-offset-2 transition-colors"
                >
                  Moahim
                </a>{" "}
                · CC BY-SA 4.0 via Wikimedia Commons
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 text-white"><Clock size={16} className="text-gold-500" /> ~6 hours</div>
              <div className="flex items-center gap-2 text-white"><MapPin size={16} className="text-gold-500" /> 415 km</div>
              <div className="flex items-center gap-2 text-white"><Star size={16} className="text-gold-500" /> from €{lourdesPrice} fixed</div>
            </div>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Lourdes Transfer — €{lourdesPrice}
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Why pilgrims choose Élite BCN for the <span className="text-gold-gradient">Lourdes journey</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: `Fixed price €${lourdesPrice}`, body: `One price covers the whole 415 km crossing into France. No meter, no surge, no per-passenger charge. VAT and motorway tolls are charged separately.` },
                { icon: Accessibility, title: "Reduced mobility welcome", body: "Tell us what you are travelling with — folding wheelchair, rollator, oxygen — and we confirm the right vehicle before you pay rather than on the day." },
                { icon: Users, title: "Parish and group pilgrimages", body: "Priced per vehicle, so a minibus of 16 costs far less per person than a sedan. Several cars can travel in convoy and arrive together." },
                { icon: Clock, title: "Direct — no changes", body: "There is no direct train or flight. Rail means two changes and a longer day; we go door to door in one leg, with comfort stops when you want them." },
                { icon: CheckCircle2, title: "Straight to the sanctuary", body: "Drop-off at the sanctuary gates, your hotel on Boulevard de la Grotte, or the Accueil for pilgrims arriving with a hospitalité group." },
                { icon: Star, title: "Same car, same driver", body: "The driver who collects you in Barcelona is the one who arrives in Lourdes — no handover at the border, no waiting for a connection." },
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
            <h2 className="font-display text-3xl text-white mb-6">About <span className="text-gold-gradient">Lourdes</span></h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Lourdes is a small market town in the <strong className="text-white">Hautes-Pyrénées</strong> that
                receives around <strong className="text-white">6 million visitors a year</strong> — more hotel beds
                than anywhere in France outside Paris. They come for the{" "}
                <strong className="text-white">Sanctuary of Our Lady of Lourdes</strong>, built around the grotto
                where Bernadette Soubirous reported eighteen apparitions of the Virgin Mary in 1858.
              </p>
              <p>
                The sanctuary grounds hold the <strong className="text-white">Grotto of Massabielle</strong>, the
                spring whose water pilgrims collect and bathe in, and three basilicas — including the mosaic-fronted{" "}
                <strong className="text-white">Basilica of Our Lady of the Rosary</strong> pictured above. The{" "}
                <strong className="text-white">torchlight Marian procession</strong> leaves the grotto each evening
                from April to October, and the Blessed Sacrament procession crosses the esplanade each afternoon.
              </p>
              <p>
                The busiest dates are the <strong className="text-white">Feast of Our Lady of Lourdes on 11 February</strong>,
                the <strong className="text-white">Assumption on 15 August</strong>, and the international
                pilgrimage season through summer. Accommodation and transport both tighten around those weeks,
                so a transfer is worth fixing early.
              </p>
              <p>
                Getting there from Barcelona is the awkward part. There is no direct flight and no direct train:
                rail routes change at Narbonne or Toulouse and can take the better part of a day with luggage.
                The road crosses the border at La Jonquera and runs through Narbonne and Toulouse before turning
                south to Tarbes — <strong className="text-white">415 km, about six hours</strong> in one car.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white text-center mb-8">Lourdes Transfer <span className="text-gold-gradient">Prices</span></h2>
            <div className="bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-dark-800">
                    <th className="text-left text-dark-400 font-medium p-4">Vehicle</th>
                    <th className="text-left text-dark-400 font-medium p-4 hidden sm:table-cell">Capacity</th>
                    <th className="text-right text-dark-400 font-medium p-4">One way</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { v: "Sedan",             cap: "3 passengers",  price: `€${LADDER.economy}`   },
                    { v: "Business sedan",    cap: "3 passengers",  price: `€${LADDER.business}`   },
                    { v: "Minivan",           cap: "6 passengers",  price: `€${LADDER.minivan}`   },
                    { v: "Mercedes V-Class",  cap: "7 passengers",  price: `€${LADDER.vclass}` },
                    { v: "Minibus",           cap: "16 passengers", price: `€${LADDER.minibus}` },
                  ].map((row) => (
                    <tr key={row.v} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-4 text-white">{row.v}</td>
                      <td className="p-4 text-dark-400 hidden sm:table-cell">{row.cap}</td>
                      <td className="p-4 text-gold-400 font-semibold text-right">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-dark-500 text-xs text-center mt-4">
              Fixed price per vehicle, not per passenger. Same price from BCN Airport or central Barcelona.
              Excl. VAT and tolls — 10% VAT is added only if you request an invoice; motorway tolls are charged
              separately. Includes meet &amp; greet. Airport pickups include 60 minutes of free waiting from landing; city, port and station pickups include 15 minutes. Return journeys and waiting time
              quoted on request.
            </p>
          </div>
        </section>

        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-10">
              Barcelona to Lourdes — <span className="text-gold-gradient">common questions</span>
            </h2>
            <div className="space-y-4">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group bg-dark-900 border border-white/[0.08] rounded-xl overflow-hidden">
                  <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4 text-white font-medium">
                    <h3 className="text-base font-medium">{q}</h3>
                    <ChevronRight size={16} className="text-gold-500 flex-shrink-0 mt-0.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 text-dark-400 text-sm leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950 border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white mb-4">Ready to book your Lourdes transfer?</h2>
            <p className="text-dark-400 mb-8">Instant confirmation. Free cancellation up to 24 hours before pickup.</p>
            <Link href="/book" className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-10 py-4 rounded-lg text-lg transition-colors">
              Book Now — from €{lourdesPrice}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
