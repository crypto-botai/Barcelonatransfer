import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Hourly Chauffeur Hire Barcelona — Private Driver from €45/hr",
  description: "Book a private chauffeur in Barcelona by the hour from €45/hr (4-hour minimum). Flexible disposal for business meetings, shopping, city tours, events, or day trips. Mercedes, Tesla, BMW.",
  alternates: { canonical: "https://www.elitebcn.info/hourly" },
  openGraph: {
    title: "Hourly Chauffeur Hire Barcelona — Private Driver from €45/hr",
    description: "Book a private chauffeur in Barcelona by the hour from €45/hr. Flexible disposal for meetings, shopping, events, or sightseeing.",
    url: "https://www.elitebcn.info/hourly",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

const HOURLY_RATES = [
  { class: "Economy / Business",    rate: 45,  pax: "1–3",  min: 4 },
  { class: "Luxury Sedan",          rate: 65,  pax: "1–3",  min: 4 },
  { class: "First Class",           rate: 110, pax: "1–3",  min: 4 },
  { class: "Executive SUV",         rate: 75,  pax: "1–5",  min: 4 },
  { class: "Minivan (Vito)",        rate: 55,  pax: "1–7",  min: 4 },
  { class: "Luxury Minivan (V-Class)", rate: 65, pax: "1–7", min: 4 },
  { class: "Minibus",               rate: 160, pax: "1–16", min: 4 },
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
            <Link href="/book?type=hourly" className="btn-gold px-8 py-4 rounded-xl font-semibold">
              Book Hourly Chauffeur
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {HOURLY_RATES.map((r) => (
                <div key={r.class} className="glass-card gold-hover-border rounded-xl p-6 text-center">
                  <h3 className="text-white font-medium mb-3">{r.class}</h3>
                  <p className="font-display text-4xl text-gold-400 mb-1">
                    {formatCurrency(r.rate)}
                  </p>
                  <p className="text-dark-500 text-xs mb-1">per hour · {r.pax} passengers</p>
                  <p className="text-dark-500 text-xs mb-5">Minimum {r.min} hours</p>
                  <Link href="/book?type=hourly" className="btn-gold block py-2.5 rounded-lg text-xs font-semibold">
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
      <WhatsAppButton />
    </>
  );
}
