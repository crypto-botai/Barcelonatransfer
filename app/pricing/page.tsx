import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import PricingSection from "@/components/sections/PricingSection";

export const metadata: Metadata = {
  title: "Fixed Transfer Prices — Barcelona Airport & Destinations",
  description: "View all fixed prices for luxury transfers from Barcelona Airport, Cruise Terminal, and city. No hidden fees. Instant online booking.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Pricing</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Fixed <span className="text-gold-gradient">Transfer Prices</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              All prices are fixed and all-inclusive. No hidden fees, no surge pricing, no surprises.
            </p>
          </div>
        </section>
        <PricingSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
