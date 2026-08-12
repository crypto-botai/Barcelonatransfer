import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import BookFormClient from "./BookFormClient";
import { getPublicRoutes } from "@/lib/pricing-service";
import { ROUTES } from "@/lib/pricing";
import { faqPage, transferService } from "@/lib/schema";

// Static metadata is generated at build time and cannot await the database, so
// the "from" figure in the meta description comes from the canonical matrix —
// the same source the database is seeded from. The visible price table below
// reads the live DB via getPublicRoutes().
const fromPrice = ROUTES.find((r) => r.from === "airport" && r.to === "barcelona_city")?.economy ?? 50;

export const metadata: Metadata = {
  title: { absolute: "Book Your Barcelona Transfer | Élite BCN" },
  description:
    `Book your Barcelona luxury transfer in 60 seconds. Fixed prices from €${fromPrice}. BCN El Prat T1/T2, cruise port, hotels, Sitges & Andorra. Instant confirmation 24/7.`,
  alternates: {
    canonical: "https://www.elitebcn.info/book",
  },
  openGraph: {
    title: `Book Your Barcelona Transfer — Fixed Prices from €${fromPrice}`,
    description:
      "Instant online booking for luxury private transfers in Barcelona. Fixed prices, no surge pricing. Mercedes V-Class & EQE 300 Electric.",
    url: "https://www.elitebcn.info/book",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Book Élite BCN Airport Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Book Your Barcelona Transfer — Fixed Prices from €${fromPrice}`,
    description:
      "Instant online booking for luxury private transfers in Barcelona. Fixed prices, no surge pricing. Mercedes V-Class & EQE 300 Electric.",
    images: ["/opengraph-image"],
  },
};

const BOOKING_STEPS = [
  { n: 1, title: "Your Journey",  body: "Enter your pickup address, destination, date, time, and number of passengers." },
  { n: 2, title: "Choose Vehicle", body: "Select from Economy EQE 300 Electric, V-Class VIP (7 pax), Vito (8 pax), or Minibus (16 pax)." },
  { n: 3, title: "Confirm & Pay",  body: "Review your fixed quote, apply any coupon code, and pay securely by card. Instant email confirmation." },
] as const;

const BOOK_FAQ = [
  { q: "How far in advance do I need to book?",       a: "We recommend booking at least 4 hours before your pickup. Bookings under 4 hours carry a 15% last-minute surcharge. We cannot accept bookings with less than 1 hour notice." },
  { q: "What does the price include?",                a: "The fixed price covers the professional chauffeur, the vehicle, fuel, meet & greet, and up to 60 minutes free waiting after landing. No surge pricing, ever. VAT and tolls are NOT included: 10% VAT is added only if you request an invoice, and motorway tolls are charged separately where the route uses them." },
  { q: "Can I cancel or change my booking?",          a: "Yes. Free cancellation up to 24 hours before pickup. Pickup address changes are free if made more than 8 hours before departure. Changes within those windows require a WhatsApp message to +34 635 383 712." },
  { q: "What if my flight is delayed?",               a: "We monitor all flights in real time. Your driver automatically adjusts to your actual landing time at no extra cost. The first 60 minutes after landing are always free." },
  { q: "Where do you pick me up at the airport?",     a: "Your driver will be waiting in the Arrivals hall of your terminal (T1 or T2) holding a name board with your name. No need to call — just follow Arrivals signs." },
  { q: "Do you offer child seats?",                   a: "Yes. Baby seats and child booster seats are €5 per seat. Add them under Special Requests when booking and tell us your child's weight." },
] as const;

// Airport & City routes for the SSR price table (Google can index these without JS)
export default async function BookPage() {
  // Read the same database-backed source the homepage and /pricing use.
  // This table previously read the hardcoded ROUTES fallback, so any price
  // edited through the admin panel would update those two pages but not this
  // one — the two surfaces would silently disagree about the same route.
  const allRoutes = await getPublicRoutes();
  const AIRPORT_ROUTES = allRoutes.filter((r) => r.category === "airport").slice(0, 5);

  const serviceSchema = transferService({
    name: "Barcelona Airport Private Transfer",
    description: "Fixed-price luxury chauffeur transfers from Barcelona El Prat Airport (T1/T2) to city centre, hotels, cruise port, and Costa Daurada. Mercedes V-Class & EQE 300 Electric. Meet & greet included.",
    url: "/book",
    priceFrom: 45,
    fromCity: "El Prat de Llobregat",
    toCity: "Barcelona",
  });

  const faqSchema = faqPage(BOOK_FAQ.map((f) => ({ q: f.q, a: f.a })));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <Navbar />

      {/* Hero / H1 */}
      <div className="pt-20 pb-6 bg-[#050505]">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">
            Book Your <span className="text-gold-gradient">Barcelona Transfer</span>
          </h1>
          <p className="text-dark-400 text-sm max-w-lg mx-auto">
            Fixed prices from €{fromPrice}. BCN El Prat T1/T2, cruise port, hotels, Sitges and Andorra. Instant confirmation 24/7.
          </p>
        </div>
      </div>

      {/* 3-step overview — server-rendered for SEO */}
      <div className="bg-[#050505] border-b border-white/[0.04]">
        <div className="container mx-auto px-4 max-w-3xl">
          <ol className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            {BOOKING_STEPS.map((s) => (
              <li key={s.n} className="flex-1 flex items-start gap-4 py-5 px-2 sm:px-6">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 text-sm font-semibold">
                  {s.n}
                </span>
                <div>
                  <p className="text-white text-sm font-medium mb-0.5">{s.title}</p>
                  <p className="text-dark-500 text-xs leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Booking form (client component) */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
        </div>
      }>
        <BookFormClient />
      </Suspense>

      {/* SSR price reference table — indexed by Google even without JS */}
      <section className="bg-[#050505] py-12 border-t border-white/[0.04]">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-white text-xl font-display mb-1">Popular Route Prices</h2>
          <p className="text-dark-400 text-xs mb-6">Fixed fares per vehicle · excl. VAT &amp; tolls · No surge pricing</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 pr-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Route</th>
                  <th className="text-center py-2 px-3 text-dark-400 font-medium text-xs uppercase tracking-wider">Economy</th>
                  <th className="text-center py-2 px-3 text-dark-400 font-medium text-xs uppercase tracking-wider">Business</th>
                  <th className="text-center py-2 px-3 text-dark-400 font-medium text-xs uppercase tracking-wider">V-Class</th>
                </tr>
              </thead>
              <tbody>
                {AIRPORT_ROUTES.map((r) => (
                  <tr key={r.label} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-dark-300">{r.label}</td>
                    <td className="py-3 px-3 text-center text-white font-medium">€{r.economy}</td>
                    <td className="py-3 px-3 text-center text-white font-medium">€{r.business}</td>
                    <td className="py-3 px-3 text-center text-gold-400 font-semibold">€{r.vclass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-dark-600 text-xs mt-4">
            Prices shown are per vehicle, not per person. Full pricing available in the booking form above.
          </p>
        </div>
      </section>

      {/* FAQ — server-rendered HTML for Google */}
      <section className="bg-[#040404] py-12 border-t border-white/[0.04]">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-white text-xl font-display mb-8">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {BOOK_FAQ.map((faq) => (
              <div key={faq.q}>
                <dt className="text-white text-sm font-medium mb-1">{faq.q}</dt>
                <dd className="text-dark-400 text-sm leading-relaxed">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
