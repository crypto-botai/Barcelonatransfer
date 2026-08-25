import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Clock, MapPin, Users, ChevronRight, Star } from "lucide-react";
import { ROUTES } from "@/lib/pricing";
import { SHARED_OG } from "@/lib/seo";

const BASE = "https://www.elitebcn.info";

// Helper: get Economy price from city for a given destination key
function cityPrice(to: string): number {
  return ROUTES.find((r) => r.from === "barcelona_city" && r.to === to)?.economy ?? 0;
}

const P = {
  montserrat:   cityPrice("montserrat"),
  sitges:       cityPrice("sitges"),
  lloret:       cityPrice("lloret"),
  andorra:      cityPrice("andorra"),
  tarragona:    cityPrice("tarragona"),
  cadaques:     cityPrice("cadaques"),
} as const;

export const metadata: Metadata = {
  title: { absolute: "Private Day Tours from Barcelona — Elite BCN Chauffeur" },
  description:
    `Private day tours from Barcelona: Montserrat (€${P.montserrat}), Sitges (€${P.sitges}), Costa Brava (€${P.lloret}), Andorra (€${P.andorra}). Fixed price, luxury vehicle, no groups.`,
  alternates: { canonical: `${BASE}/day-tours` },
  keywords: ["private day tours barcelona", "barcelona montserrat tour", "barcelona sitges day trip", "barcelona costa brava tour"],
  openGraph: {
    ...SHARED_OG,
    title: "Private Day Tours from Barcelona — Elite BCN",
    description:
      "Discover Catalonia with a private chauffeur. Montserrat, Sitges, Costa Brava, Andorra — fixed prices, no groups, door-to-door.",
    url: `${BASE}/day-tours`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Elite BCN — Private Day Tours from Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Day Tours from Barcelona — Elite BCN",
    description: "Montserrat, Sitges, Costa Brava, Andorra — private chauffeur, fixed prices, no groups.",
    images: [`${BASE}/opengraph-image`],
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",      item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "Day Tours", item: "https://www.elitebcn.info/day-tours" },
  ],
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Private Day Tours from Barcelona",
  serviceType: "Private Chauffeur Day Tour",
  provider: { "@id": "https://www.elitebcn.info/#business" },
  areaServed: { "@type": "City", name: "Barcelona" },
  description:
    "Luxury private day tours from Barcelona: Montserrat, Sitges, Costa Brava, Andorra and more — fixed price, private vehicle, no groups.",
  url: `${BASE}/day-tours`,
};

const TOURS = [
  {
    name: "Montserrat Monastery",
    slug: "montserrat",
    distance: "50 km",
    duration: "50 min",
    from: `€${P.montserrat}`,
    highlight: "Catalonia's sacred mountain. See the Black Madonna, the Escolania choir, and panoramic views over the plains.",
    tags: ["Half day", "Cultural", "Hiking"],
  },
  {
    name: "Sitges",
    slug: "sitges",
    distance: "35 km",
    duration: "35 min",
    from: `€${P.sitges}`,
    highlight: "Barcelona's glamorous coastal neighbour. White-washed old town, seafront promenade, and excellent restaurants.",
    tags: ["Half day", "Beach", "Food"],
  },
  {
    name: "Costa Brava",
    slug: "costa-brava",
    distance: "100 km",
    duration: "80 min",
    from: `€${P.lloret}`,
    highlight: "Wild Mediterranean coastline: Tossa de Mar, Lloret, Palamós. Coastal villages and crystal-clear coves.",
    tags: ["Full day", "Beach", "Scenic"],
  },
  {
    name: "Andorra",
    slug: "andorra",
    distance: "220 km",
    duration: "2h 45min",
    from: `€${P.andorra}`,
    highlight: "Duty-free shopping and Pyrenean mountain scenery. Perfect for electronics, spirits, and designer goods.",
    tags: ["Full day", "Shopping", "Mountains"],
  },
  {
    name: "Tarragona",
    slug: "tarragona",
    distance: "100 km",
    duration: "70 min",
    from: `€${P.tarragona}`,
    highlight: "UNESCO Roman ruins: amphitheatre, forum, aqueduct. Roman Tarraco with a striking sea-cliff setting.",
    tags: ["Half day", "History", "UNESCO"],
  },
  {
    name: "Cadaqués",
    slug: "costa-brava",
    distance: "180 km",
    duration: "2h 15min",
    from: `€${P.cadaques}`,
    highlight: "The most beautiful village on the Costa Brava. Dalí's home, white cubed houses, cobalt Mediterranean.",
    tags: ["Full day", "Art", "Scenic"],
  },
];

export default function DayToursPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-24 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,168,76,0.09),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
            <div className="flex justify-center items-center gap-2 mb-6 text-sm text-dark-400">
              <Link href="/" className="hover:text-gold-400 transition-colors">Home</Link>
              <ChevronRight size={14} className="text-dark-500" />
              <span className="text-gold-400">Day Tours</span>
            </div>
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
              Private · Door-to-Door · Fixed Price
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6 leading-tight">
              Private Day Tours <br />
              <span className="text-gold-gradient">from Barcelona</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-xl mx-auto mb-10">
              Discover Catalonia and beyond with your own luxury chauffeur. No groups, no coaches,
              no fixed schedules — just you, your vehicle, and the open road.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-dark-300">
              <span className="flex items-center gap-2"><Star size={14} className="text-gold-500" /> Fixed price, no meter</span>
              <span className="flex items-center gap-2"><Users size={14} className="text-gold-500" /> Up to 7 passengers</span>
              <span className="flex items-center gap-2"><Clock size={14} className="text-gold-500" /> Driver waits for you</span>
            </div>
          </div>
        </section>

        {/* Tours grid */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              Popular <span className="text-gold-gradient">Day Trips</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {TOURS.map((tour) => (
                <div
                  key={tour.name}
                  className="bg-dark-900 border border-white/[0.08] rounded-2xl p-6 flex flex-col hover:border-gold-500/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display text-xl text-white">{tour.name}</h3>
                    <span className="text-gold-400 font-semibold text-lg shrink-0 ml-3">from {tour.from}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-dark-400 mb-4">
                    <span className="flex items-center gap-1"><MapPin size={11} className="text-gold-500/60" /> {tour.distance}</span>
                    <span className="flex items-center gap-1"><Clock size={11} className="text-gold-500/60" /> {tour.duration}</span>
                  </div>
                  <p className="text-dark-300 text-sm leading-relaxed mb-5 flex-1">{tour.highlight}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {tour.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full border border-gold-500/20 text-gold-500 bg-gold-500/5">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/book?destination=${encodeURIComponent(tour.name)}`}
                    className="btn-gold block text-center py-3 rounded-xl text-sm font-semibold"
                  >
                    Book {tour.name} Day Tour
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              How It <span className="text-gold-gradient">Works</span>
            </h2>
            <div className="space-y-8">
              {[
                { step: "01", title: "Choose your destination", body: "Select from our popular day-tour routes or request a custom itinerary to anywhere in Catalonia, Aragon or southern France." },
                { step: "02", title: "We pick you up at your door", body: "Hotel lobby, apartment address or Barcelona Airport — your chauffeur arrives punctually with a name board." },
                { step: "03", title: "Your driver waits for you", body: "Enjoy your destination at your own pace. Your chauffeur stays nearby and drives you back when you're ready. Free waiting included." },
                { step: "04", title: "Return home relaxed", body: "No train connections, no taxis, no luggage hassle. Door-to-door, exactly the same luxury comfort on the return leg." },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex gap-6">
                  <div className="text-gold-500/40 font-display text-3xl font-semibold w-12 shrink-0">{step}</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">{title}</h3>
                    <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-dark-950 text-center">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="max-w-3xl mx-auto text-left mb-14 space-y-4 text-dark-300 leading-relaxed">
              <h3 className="font-display text-2xl text-white">How a private day out works</h3>
              <p>
                A day tour is a private car and driver for the day, not a coach with a schedule. There
                is no group to wait for, no fixed departure and no set time to be back at the bus. You
                decide when to leave, how long to stay and whether to add a stop on the way home.
              </p>
              <p>
                Your driver is a licensed chauffeur rather than a licensed guide, which is an important
                distinction and one some operators blur. They will get you there, tell you what they
                know about the area and wait while you visit — but where a site requires an official
                guide to go inside, that is booked separately and we will say so before you commit
                rather than after.
              </p>
              <p>
                Pricing follows the same principle as everything else on this site: per vehicle, not
                per person, and agreed before you travel. A family of four pays the car once. Days
                with several stops are usually priced by the hour — the{" "}
                <Link href="/hourly" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">hourly chauffeur page</Link>{" "}
                explains how that works and what the minimum is — while a single out-and-back run to
                one place is often cheaper as a{" "}
                <Link href="/pricing" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">fixed-price transfer</Link>.
              </p>
              <h3 className="font-display text-2xl text-white pt-4">Planning the day</h3>
              <p>
                Two destinations in a day is comfortable. Three is possible if they are close together,
                and four is a day spent mostly in the car. The drives out of Barcelona are longer than
                the map suggests once you are past the ring road, particularly north towards the{" "}
                <Link href="/transfers/costa-brava" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">Costa Brava</Link>{" "}
                and inland towards{" "}
                <Link href="/transfers/montserrat" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">Montserrat</Link>.
              </p>
              <p>
                Tell us what you want to see rather than a route, and let the driver build the order —
                opening times, the direction the traffic runs and where lunch is realistic all change
                what sequence works. If you are travelling with children or anyone who does not want a
                long day, say so when you book: a shorter itinerary that finishes well beats a full one
                that ends badly.
              </p>
              <p>
                Vehicles for day tours are the same fleet as everything else, and boot space matters
                less here than legroom. The{" "}
                <Link href="/fleet" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">fleet page</Link>{" "}
                lists what each car seats, and the{" "}
                <Link href="/faq" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">FAQ</Link>{" "}
                covers child seats, payment and cancellation.
              </p>
            </div>

            <h2 className="font-display text-3xl text-white mb-4">Ready to Explore Catalonia?</h2>
            <p className="text-dark-400 mb-8">
              Instant confirmation. Free cancellation up to 24 hours before pickup. No hidden fees.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">
                Book a Day Tour
              </Link>
              <Link href="/transfers" className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2">
                See All Destinations <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
