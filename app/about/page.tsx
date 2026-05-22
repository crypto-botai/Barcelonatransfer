import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Élite BCN — Barcelona's Premier Luxury Transfer Company",
  description: "Élite BCN is Barcelona's premier licensed VTC transfer company. 4.9★ rated, 500+ five-star reviews. Professional multilingual drivers, premium Mercedes & Tesla fleet, impeccable service since 2024.",
  alternates: { canonical: "https://www.elitebcn.info/about" },
  openGraph: {
    title: "About Élite BCN — Barcelona's Premier Luxury Transfer Company",
    description: "4.9★ rated luxury private transfer company in Barcelona. Licensed VTC, professional drivers, premium fleet. 500+ five-star reviews.",
    url: "https://www.elitebcn.info/about",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export default function AboutPage() {
  return (
    <>
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
                    <a href="mailto:vtcbcn2025@gmail.com" className="text-gold-400 hover:text-gold-300">vtcbcn2025@gmail.com</a>
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
      <WhatsAppButton />
    </>
  );
}
