import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { COMPANY, SOCIAL_PROOF, OPERATIONS } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "About Elite BCN — Barcelona Chauffeur Company" },
  description: `Licensed VTC chauffeur service in Barcelona since ${COMPANY.foundedYear}. Professional drivers, Mercedes V-Class, EQE 300 Electric and Tesla Model 3.`,
  alternates: { canonical: "https://www.elitebcn.info/about" },
  keywords: ["about elite bcn", "barcelona vtc company", "licensed vtc barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "About Elite BCN — Barcelona's Luxury Transfer Company",
    description: `Licensed VTC private transfer company in Barcelona, rated ${SOCIAL_PROOF.google.rating} on Google from ${SOCIAL_PROOF.google.count} reviews.`,
    url: "https://www.elitebcn.info/about",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN Transfers — About Our Company" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Elite BCN — Barcelona's Luxury Transfer Company",
    description: "Licensed VTC private transfer company in Barcelona. Professional drivers, premium fleet, fixed prices.",
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
      name:    "About Elite BCN Transfers",
      description: `Licensed VTC chauffeur company in Barcelona since ${COMPANY.foundedYear}, rated ${SOCIAL_PROOF.google.rating} on Google from ${SOCIAL_PROOF.google.count} reviews.`,
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
      name:          "Elite BCN Transfers",
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
                Founded in Barcelona in 2018, Elite BCN was created with a single mission: to deliver a level of chauffeur service that genuinely rivals the world&apos;s finest cities. Not just a transfer — an experience.
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
              {/* Read from lib/company-facts rather than typed here, so the
                  founding year, the transfer count and the rating cannot drift
                  from what the rest of the site and the structured data say. */}
              {[
                { v: String(COMPANY.foundedYear), l: "Founded" },
                { v: OPERATIONS.transfersDisplay, l: "Transfers" },
                { v: `${SOCIAL_PROOF.google.rating}★`, l: "Rating" },
                { v: OPERATIONS.supportHours, l: "Available" },
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

        {/* How the business actually operates. The page had a short story and a
            values list, and said nothing about licensing or pricing. */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              How we <span className="text-gold-gradient">operate</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                Elite BCN runs under a Spanish VTC licence, the permit required to carry
                passengers by private hire in Spain. It is not the same as a taxi licence and the
                difference is worth knowing: a VTC journey is booked in advance, priced in
                advance, and cannot be hailed on the street. That is why we can quote a fixed fare
                weeks ahead and hold it, and why there is no meter in the car.
              </p>
              <p>
                Every fare is per vehicle rather than per seat, and it is the fare you pay. It does
                not rise at night, at the weekend, during Mobile World Congress, or because the
                Ronda Litoral is at a standstill. Tolls and VAT sit outside the quote &mdash; VAT is
                added only when you ask for an invoice &mdash; and the extras that are genuinely
                optional, like child seats or a name board at arrivals, are priced separately so
                nobody pays for something they did not want.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Private, always</h3>
              <p>
                We do not run shared shuttles. We never combine two bookings into one vehicle, and
                we do not sell transfers seat by seat. When you book, the car is yours from your
                pickup point to your destination, with no other passengers and no stops you did not
                ask for. It is a deliberate limit on the business rather than a marketing line
                &mdash; it is the reason we can promise a pickup time and keep it.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Airport pickups</h3>
              <p>
                Arrivals are where transfers usually go wrong, so they get the most attention. We
                track your flight by its number, so a delay moves your pickup rather than costing
                you the booking, and an early landing is met early. Airport pickups include 60
                minutes of free waiting from the moment the wheels touch down, which covers
                passport control and baggage reclaim on all but the worst days at El Prat. City,
                cruise port and station pickups include 15 minutes.
              </p>
              <h3 className="font-display text-xl text-white pt-4">The fleet</h3>
              <p>
                Seven vehicles, from a Toyota Corolla for a solo traveller to a 16-seat Mercedes
                Sprinter for a group, with Tesla Model 3 and Mercedes EQE electric options in
                between. We publish the passenger and luggage capacity of each one, because the
                boot is more often the limit than the seats, and the wrong choice is discovered at
                the kerb with nowhere to put a suitcase.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
