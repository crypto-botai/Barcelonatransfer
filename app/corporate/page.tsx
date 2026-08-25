import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Corporate Chauffeur Barcelona — Executive Travel | Elite BCN" },
  description: "Corporate chauffeur in Barcelona. Executive airport transfers, roadshows, board meetings & MICE events. Monthly invoicing, account manager. VTC licensed.",
  alternates: { canonical: "https://www.elitebcn.info/corporate" },
  keywords: ["corporate chauffeur barcelona", "executive transfer barcelona", "business chauffeur barcelona", "corporate account chauffeur"],
  openGraph: {
    ...SHARED_OG,
    title: "Corporate Chauffeur Barcelona — Executive Travel | Elite BCN",
    description: "Dedicated corporate chauffeur accounts in Barcelona. Executive airport transfers, roadshows, events. Monthly invoicing, account manager.",
    url: "https://www.elitebcn.info/corporate",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Corporate Chauffeur Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Corporate Chauffeur Barcelona — Executive Travel | Elite BCN",
    description: "Dedicated corporate chauffeur accounts in Barcelona. Executive airport transfers, roadshows, events. Monthly invoicing, account manager.",
    images: ["/opengraph-image"],
  },
};

const CORPORATE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Corporate Chauffeur Barcelona",
  serviceType: "Corporate Chauffeur Service",
  provider: { "@id": "https://www.elitebcn.info/#business" },
  areaServed: { "@type": "City", name: "Barcelona", sameAs: "https://www.wikidata.org/wiki/Q1492" },
  description: "Dedicated corporate chauffeur accounts in Barcelona for executive airport transfers, roadshows, board meetings and MICE events. Monthly invoicing available.",
  url: "https://www.elitebcn.info/corporate",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",      item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Corporate", item: "https://www.elitebcn.info/corporate" },
    ],
  },
};

export default function CorporatePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(CORPORATE_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Corporate</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Barcelona Executive & <span className="text-gold-gradient">Corporate Travel</span>
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
            {/* The cards below are h3; without this the page went h1 to h3. */}
            <h2 className="font-display text-3xl text-white text-center mb-10">
              How corporate accounts <span className="text-gold-gradient">work</span>
            </h2>
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

        {/* How an account actually opens. The page listed six benefits and
            stopped, which left the obvious next question unanswered. */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Opening an <span className="text-gold-gradient">account</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                There is no application process to sit through. Send us your company name, tax
                number and billing address, tell us roughly how many transfers a month you expect
                and which routes come up most often, and we will confirm terms in writing. Most
                accounts are open and usable the same week.
              </p>
              <p>
                Once the account exists, your team books the way everyone else does &mdash; online, by
                email or over WhatsApp &mdash; but nothing is charged at the point of booking. Journeys
                collect against the account and are invoiced together at the end of the month,
                with every trip itemised: date, passenger, route, vehicle and fare. Spanish VAT at
                10% is applied on the invoice, so the figures reconcile cleanly for your finance
                team.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Events and multiple vehicles</h3>
              <p>
                Conferences, roadshows and investor days need more coordination than a single
                airport run, and they are worth flagging early. Tell us the arrival windows and
                passenger counts and we will assign vehicles across the day rather than treating
                each transfer as an unrelated booking. For large groups the Mercedes Sprinter
                carries up to 16 passengers, and mixed fleets &mdash; a V-Class for principals with
                minivans behind &mdash; are usually the right answer for a delegation.
              </p>
              <h3 className="font-display text-xl text-white pt-4">What stays the same</h3>
              <p>
                Corporate pricing is still fixed per vehicle and agreed before travel: no meter,
                no peak-time multiplier, no airport supplement appearing at drop-off. Airport
                pickups include 60 minutes of free waiting from the actual landing time, which
                matters more for business travellers than anyone, and every journey is private
                &mdash; we never combine bookings or put another company&apos;s passengers in your car.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
