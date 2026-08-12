import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FAQAccordion from "@/components/faq/FAQAccordion";
import { FAQ_GROUPS } from "@/lib/faq-data";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ — Barcelona Transfer Questions Answered | Elite BCN",
  description: "Answers to the most common questions about booking a luxury private transfer in Barcelona — pricing, fleet, airport pickups, cancellation, child seats and more.",
  alternates: { canonical: "https://www.elitebcn.info/faq" },
  keywords: ["barcelona transfer faq", "airport transfer questions", "vtc barcelona faq", "private transfer barcelona help"],
  openGraph: {
    ...SHARED_OG,
    title: "FAQ — Barcelona Transfer Questions Answered | Elite BCN",
    description: "Everything you need to know about booking a luxury private transfer in Barcelona. Fixed prices, fleet, airport pickups, cancellation policy.",
    url: "https://www.elitebcn.info/faq",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN Transfers — Frequently Asked Questions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ — Barcelona Transfer Questions | Elite BCN",
    description: "Everything you need to know about booking a luxury private transfer in Barcelona.",
    images: ["/opengraph-image"],
  },
};

// Build FAQPage JSON-LD from the same source-of-truth data
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((g) =>
    g.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.elitebcn.info" },
    { "@type": "ListItem", position: 2, name: "FAQ",   item: "https://www.elitebcn.info/faq" },
  ],
};

export default function FAQPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Help Centre</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">
              Everything you need to know about booking your luxury transfer in Barcelona.
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <FAQAccordion />

            {/* Still have questions CTA */}
            <div className="mt-14 glass-card rounded-2xl p-8 text-center gold-hover-border">
              <h2 className="font-display text-2xl text-white mb-2">Still have questions?</h2>
              <p className="text-dark-400 text-sm mb-6">Our team is available 24/7 — reply within minutes.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="https://wa.me/34635383712"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-gold flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold"
                >
                  <MessageCircle size={16} />
                  Chat on WhatsApp
                </a>
                <Link
                  href="/contact"
                  className="btn-outline-gold flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold"
                >
                  Send a Message
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
