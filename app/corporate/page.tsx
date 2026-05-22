import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Corporate Chauffeur Barcelona — Executive Transfers & Business Travel",
  description: "Dedicated corporate chauffeur accounts in Barcelona. Executive airport transfers, roadshows, board meetings, MICE events. Dedicated fleet, monthly invoicing, account manager. VTC licensed.",
  alternates: { canonical: "https://www.elitebcn.info/corporate" },
  openGraph: {
    title: "Corporate Chauffeur Barcelona — Executive Transfers & Business Travel",
    description: "Dedicated corporate chauffeur accounts in Barcelona. Executive airport transfers, roadshows, events. Monthly invoicing, account manager.",
    url: "https://www.elitebcn.info/corporate",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function CorporatePage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Corporate</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Executive & <span className="text-gold-gradient">Corporate Travel</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto mb-10">
              Dedicated corporate accounts with priority fleet allocation, consolidated invoicing, and a dedicated account manager available 24/7.
            </p>
            <Link href="/contact" className="btn-gold px-8 py-4 rounded-xl font-semibold">
              Open Corporate Account
            </Link>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { title: "Priority Fleet",          desc: "Guaranteed vehicle availability for your team, even during peak demand or major events in Barcelona." },
                { title: "Monthly Invoicing",        desc: "Consolidated monthly invoices with full trip reporting. Simplify your corporate travel accounting." },
                { title: "Dedicated Manager",        desc: "A single point of contact who knows your preferences, routes, and traveller profiles." },
                { title: "Custom Contracts",         desc: "Volume pricing and bespoke service agreements for companies with regular transfer requirements." },
                { title: "Multi-Vehicle Events",     desc: "Coordinating 20+ vehicles for conferences, roadshows, or investor events across Barcelona." },
                { title: "Executive Reporting",      desc: "Monthly travel reports, CO₂ offset certificates, and expense integration for your finance team." },
              ].map((f) => (
                <div key={f.title} className="glass-card gold-hover-border rounded-xl p-6">
                  <h3 className="text-gold-400 font-display text-lg mb-3">{f.title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
