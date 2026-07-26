import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Élite BCN — Barcelona's Luxury Transfer Company",
  description: "4.9★ rated, 595+ reviews. Licensed VTC chauffeur service in Barcelona since 2018. Professional drivers, Mercedes V-Class, EQE 300 Electric & Tesla Model 3.",
  alternates: { canonical: "https://www.elitebcn.info/about" },
  keywords: ["about elite bcn", "barcelona vtc company", "luxury chauffeur barcelona", "licensed vtc barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "About Élite BCN — Barcelona's Luxury Transfer Company",
    description: "4.9★ rated luxury private transfer company in Barcelona. Licensed VTC, professional drivers, premium fleet. 595+ five-star reviews.",
    url: "https://www.elitebcn.info/about",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN Transfers — About Our Company" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Élite BCN — Barcelona's Luxury Transfer Company",
    description: "4.9★ rated luxury private transfer company in Barcelona. Licensed VTC, professional drivers, premium fleet.",
    images: ["/opengraph-image"],
  },
};

const aboutSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id":   "https://www.elitebcn.info/about",
      url:     "https://www.elitebcn.info/about",
      name:    "About Élite BCN Transfers",
      description: "Licensed VTC chauffeur company in Barcelona since 2018. 4.9★ rated with 595+ five-star reviews.",
      inLanguage: "en",
      isPartOf: { "@id": "https://www.elitebcn.info" },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.elitebcn.info" },
          { "@type": "ListItem", position: 2, name: "About", item: "https://www.elitebcn.info/about" },
        ],
      },
    },
    {
      "@type":       "Organization",
      "@id":         "https://www.elitebcn.info/#organization",
      name:          "Élite BCN Transfers",
      url:           "https://www.elitebcn.info",
      foundingDate:  "2018",
      description:   "Licensed VTC private chauffeur service in Barcelona. Airport transfers, corporate travel, luxury fleet.",
      logo:          { "@type": "ImageObject", url: "https://www.elitebcn.info/favicon.svg" },
      contactPoint:  { "@type": "ContactPoint", telephone: "+34-635-383-712", contactType: "customer service", availableLanguage: ["English", "Spanish"] },
      address: {
        "@type":           "PostalAddress",
        addressLocality:   "Barcelona",
        addressRegion:     "Catalonia",
        addressCountry:    "ES",
      },
      aggregateRating: {
        "@type":       "AggregateRating",
        ratingValue:   "4.9",
        reviewCount:   "595",
        bestRating:    "5",
      },
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Our Story</span>
              <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
                Barcelona&apos;s <span className="text-gold-gradient">Luxury Standard</span>
              </h1>
              <p className="text-dark-300 text-lg leading-relaxed mb-8">
                Founded in Barcelona in 2018, Élite BCN was created with a single mission: to deliver a level of chauffeur service that genuinely rivals the world&apos;s finest cities. Not just a transfer — an experience.
              </p>
              <p className="text-dark-400 leading-relaxed">
                We are a licensed VTC operator serving Barcelona, Catalonia, and beyond. Our professional drivers speak English, Spanish, and Catalan. Every vehicle in our fleet is premium, immaculate, and never older than 3 years.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-6 text-center mb-16">
              {[
                { v: "2018", l: "Founded" },
                { v: "5,000+", l: "Transfers" },
                { v: "4.9★", l: "Rating" },
                { v: "24/7", l: "Available" },
              ].map((s) => (
                <div key={s.l} className="glass-card rounded-xl p-6">
                  <p className="font-display text-4xl text-gold-400 mb-2">{s.v}</p>
                  <p className="text-dark-400 text-sm">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="font-display text-3xl text-white mb-6">
                  Our <span className="text-gold-gradient">Values</span>
                </h2>
                <div className="space-y-4">
                  {[
                    { t: "Punctuality",  d: "We arrive early so you never wait. Flight monitoring, real-time tracking, zero excuses." },
                    { t: "Discretion",   d: "High-profile clients trust us with their privacy. Confidentiality is non-negotiable." },
                    { t: "Excellence",   d: "Spotless vehicles, professional dress code, no shortcuts on service quality." },
                    { t: "Transparency", d: "What you're quoted is what you pay. No surcharges. No surprises." },
                  ].map((v) => (
                    <div key={v.t} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-gold-500 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-white font-medium mb-1">{v.t}</p>
                        <p className="text-dark-400 text-sm">{v.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-2xl p-8">
                <h3 className="font-display text-2xl text-white mb-4">Contact Us</h3>
                <div className="space-y-3 text-sm">
                  <p className="text-dark-400">
                    <span className="text-dark-200">Email: </span>
                    <a href={`mailto:${COMPANY.email}`} className="text-gold-400 hover:text-gold-300">{COMPANY.email}</a>
                  </p>
                  <p className="text-dark-400">
                    <span className="text-dark-200">Phone: </span>
                    <a href="tel:+34635383712" className="text-gold-400 hover:text-gold-300">+34 635 383 712</a>
                  </p>
                  <p className="text-dark-400">
                    <span className="text-dark-200">WhatsApp: </span>
                    <a href="https://wa.me/34635383712" className="text-gold-400 hover:text-gold-300">+34 635 383 712</a>
                  </p>
                  <p className="text-dark-400">
                    <span className="text-dark-200">Location: </span> Barcelona, Spain
                  </p>
                </div>
                <Link href="/book" className="btn-gold block text-center py-3 rounded-xl mt-6 font-semibold text-sm">
                  Book a Transfer
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
