import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Star, Shield, Phone, Clock, MapPin, ChevronRight } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";

const BASE = "https://www.elitebcn.info";

export const metadata: Metadata = {
  title: { absolute: "VIP Transportation Barcelona — Elite BCN Private Chauffeur" },
  description:
    "VIP chauffeur in Barcelona: private jet meets, gala events, executive roadshows, red-carpet arrivals. Discreet, punctual, fully licensed. Available 24/7.",
  alternates: { canonical: `${BASE}/vip-transportation` },
  keywords: ["vip transportation barcelona", "celebrity chauffeur barcelona", "private jet transfer barcelona", "executive transport barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "VIP Transportation Barcelona — Elite BCN Private Chauffeur",
    description:
      "Discreet VIP chauffeur service for celebrities, executives and dignitaries. Private jet meets, gala event transport, red-carpet arrivals.",
    url: `${BASE}/vip-transportation`,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: "Elite BCN — VIP Transportation Barcelona" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIP Transportation Barcelona — Elite BCN",
    description: "Discreet VIP chauffeur for celebrities, executives, private jet meets and gala events in Barcelona.",
    images: [`${BASE}/opengraph-image`],
  },
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",               item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "VIP Transportation", item: "https://www.elitebcn.info/vip-transportation" },
  ],
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "VIP Transportation Barcelona",
  serviceType: "VIP Chauffeur Service",
  provider: { "@type": "Organization", name: "Elite BCN Transfers", url: BASE },
  areaServed: { "@type": "City", name: "Barcelona" },
  description:
    "Discreet, luxury VIP transportation for high-profile clients: private jet connections, gala arrivals, executive roadshows and red-carpet events.",
  url: `${BASE}/vip-transportation`,
};

const SERVICES = [
  {
    icon: "✈",
    title: "Private Jet Meets",
    body: "FBO-side meet & greet at Barcelona El Prat, discreet airside access coordination, seamless transition from runway to vehicle.",
  },
  {
    icon: "🎭",
    title: "Gala & Red-Carpet Events",
    body: "Choreographed arrivals at MNAC, Palau de la Música, Gran Teatre del Liceu and major Barcelona venues. Timing matched to your call sheet.",
  },
  {
    icon: "💼",
    title: "Executive Roadshows",
    body: "Multi-stop Barcelona roadshows for C-suite and investor meetings. Real-time itinerary management, secure WiFi en route.",
  },
  {
    icon: "🛥",
    title: "Superyacht Transfers",
    body: "Port Olímpic and Port Vell marina connections. Luggage-handling and tender coordination arranged on request.",
  },
  {
    icon: "🛡",
    title: "Discreet & Confidential",
    body: "NDAs available. No third-party sharing of client details. Plain-clothes chauffeurs on request. Zero social media.",
  },
  {
    icon: "⭐",
    title: "Concierge Assistance",
    body: "Restaurant reservations, hotel upgrades, last-minute logistics. Our operations team is reachable 24/7 for your account.",
  },
];

export default function VIPTransportationPage() {
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
              <span className="text-gold-400">VIP Transportation</span>
            </div>
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
              Discreet · Punctual · Exclusive
            </span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6 leading-tight">
              VIP Transportation <br />
              <span className="text-gold-gradient">Barcelona</span>
            </h1>
            <p className="text-dark-400 text-lg max-w-xl mx-auto mb-10">
              Luxury chauffeur service for celebrities, executives, and dignitaries. Private jet
              meets, gala arrivals, and executive roadshows — handled with complete discretion.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/book"
                className="btn-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                Request VIP Service <Star size={15} />
              </Link>
              <a
                href="https://wa.me/34635383712"
                target="_blank"
                rel="noreferrer"
                className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                <Phone size={15} /> WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Services grid */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl sm:text-4xl text-white text-center mb-12">
              VIP <span className="text-gold-gradient">Services</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {SERVICES.map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="bg-dark-900 border border-white/[0.08] rounded-2xl p-6 hover:border-gold-500/20 transition-colors"
                >
                  <span className="text-3xl mb-4 block">{icon}</span>
                  <h3 className="font-display text-lg text-white mb-3">{title}</h3>
                  <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fleet callout */}
        <section className="py-20 bg-[#050505] border-y border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="font-display text-3xl text-white mb-6">
              VIP-Ready <span className="text-gold-gradient">Fleet</span>
            </h2>
            <p className="text-dark-400 mb-10 max-w-xl mx-auto">
              All vehicles are under 3 years old, professionally valeted before every journey, and
              stocked with chilled water, phone chargers and noise-cancelling privacy screens on
              request.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {[
                { name: "Mercedes V-Class VIP", detail: "Up to 7 pax · Luxury MPV · Groups & families", from: "€70" },
                { name: "Mercedes EQE 300 Electric", detail: "Executive sedan · 1–4 pax · Airport meetings", from: "€55" },
                { name: "Mercedes Vito", detail: "Executive minivan · Up to 8 pax · Large groups", from: "€65" },
              ].map((v) => (
                <div key={v.name} className="bg-dark-900 border border-white/[0.08] rounded-xl p-6">
                  <p className="text-white font-semibold mb-1">{v.name}</p>
                  <p className="text-dark-400 text-sm mb-3">{v.detail}</p>
                  <p className="text-gold-400 font-display text-xl">from {v.from}</p>
                </div>
              ))}
            </div>
            <Link href="/fleet" className="btn-outline-gold px-6 py-3 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              View Full Fleet <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* Why Elite BCN */}
        <section className="py-20 bg-dark-950">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display text-3xl text-white text-center mb-12">
              Why High-Profile Clients Choose{" "}
              <span className="text-gold-gradient">Elite BCN</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[
                { icon: Shield, title: "Fully Licensed & Insured", body: "Licensed VTC operator under Generalitat de Catalunya. Full commercial passenger liability." },
                { icon: Clock, title: "24/7 Operations Team", body: "Your dedicated contact reachable via WhatsApp, phone or email at any hour, 365 days a year." },
                { icon: MapPin, title: "Airport & Hotel Coordination", body: "Direct liaison with concierge teams at all major Barcelona 5-star hotels and airport FBO operators." },
                { icon: Star, title: "Strict Confidentiality", body: "Client details are never shared with third parties. NDAs provided on request. Zero social-media policy." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-gold-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{title}</h3>
                    <p className="text-dark-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#050505] border-t border-white/[0.06] text-center">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="font-display text-3xl text-white mb-4">Ready to Arrange VIP Transport?</h2>
            <p className="text-dark-400 mb-8">
              Contact us directly for bespoke VIP arrangements. We respond within 15 minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/book" className="btn-gold px-8 py-4 rounded-xl font-semibold">
                Book Online
              </Link>
              <a
                href="https://wa.me/34635383712"
                target="_blank"
                rel="noreferrer"
                className="btn-outline-gold px-8 py-4 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                <Phone size={15} /> +34 635 383 712
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
