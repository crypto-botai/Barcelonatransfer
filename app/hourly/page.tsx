import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";

const MIN_RATE = HOURLY_RATES.ECONOMY;
const MIN_HOURS = MIN_HOURLY_HOURS.ECONOMY;

export const metadata: Metadata = {
  title: { absolute: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Élite BCN` },
  description: `Private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr (${MIN_HOURS}-hr minimum). Flexible disposal for meetings, shopping, city tours & events. Mercedes V-Class & EQE 300 Electric.`,
  alternates: { canonical: "https://www.elitebcn.info/hourly" },
  openGraph: {
    title: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Élite BCN`,
    description: `Book a private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr. Flexible disposal for meetings, shopping, events, or sightseeing.`,
    url: "https://www.elitebcn.info/hourly",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Hourly Chauffeur Barcelona — From €${MIN_RATE}/hr | Élite BCN`,
    description: `Book a private chauffeur in Barcelona by the hour from €${MIN_RATE}/hr. Flexible disposal for meetings, shopping, events, or sightseeing.`,
    images: ["/opengraph-image"],
  },
};

const RATE_CARDS = [
  { class: "Economy (Toyota Corolla / Camry)", rate: HOURLY_RATES.ECONOMY,        pax: "1–3",  min: MIN_HOURLY_HOURS.ECONOMY        },
  { class: "Business / Electric Sedan",        rate: HOURLY_RATES.LUXURY,         pax: "1–4",  min: MIN_HOURLY_HOURS.LUXURY         },
  { class: "Minivan (Mercedes Vito)",          rate: HOURLY_RATES.MINIVAN,        pax: "1–8",  min: MIN_HOURLY_HOURS.MINIVAN        },
  { class: "Luxury Minivan (Mercedes V-Class)",rate: HOURLY_RATES.LUXURY_MINIVAN, pax: "1–7",  min: MIN_HOURLY_HOURS.LUXURY_MINIVAN },
];

export default function HourlyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Hourly Hire</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Private Chauffeur <span className="text-gold-gradient">By the Hour</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Your professional chauffeur at complete disposal for meetings, shopping, touring, or multi-stop business days. Minimum 4 hours.
            </p>
            <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">
              Book Hourly Chauffeur
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {RATE_CARDS.map((r) => (
                <div key={r.class} className="glass-card gold-hover-border rounded-xl p-6 text-center">
                  <h3 className="text-white font-medium mb-3">{r.class}</h3>
                  <p className="font-display text-4xl text-gold-400 mb-1">
                    {formatCurrency(r.rate)}
                  </p>
                  <p className="text-dark-500 text-xs mb-1">per hour · {r.pax} passengers</p>
                  <p className="text-dark-500 text-xs mb-5">Minimum {r.min} hours</p>
                  <Link href="/book" className="btn-gold block py-2.5 rounded-lg text-xs font-semibold">
                    Book Now
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-dark-500 text-xs mt-8">
              All hourly rates include the professional chauffeur, vehicle, fuel, and tolls.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
