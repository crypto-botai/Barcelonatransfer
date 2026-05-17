import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import FleetSection from "@/components/sections/FleetSection";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Luxury Fleet — Mercedes, BMW, Tesla, Range Rover",
  description:
    "Explore our luxury fleet: Mercedes S-Class, BMW 7 Series, Tesla Model S, Range Rover Autobiography, Mercedes V-Class, and Sprinter Minibus. All available for private hire in Barcelona.",
};

export default function FleetPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Page header */}
        <section className="py-16 bg-[#050505] border-b border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Our Fleet</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Luxury Vehicle <span className="text-gold-gradient">Fleet</span>
            </h1>
            <p className="text-dark-400 max-w-2xl mx-auto">
              From executive sedans to VIP minivans — every vehicle in our fleet is professionally maintained, less than 3 years old, and equipped with premium amenities.
            </p>
          </div>
        </section>

        <FleetSection />

        {/* CTA */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl text-white mb-4">Ready to Book?</h2>
            <p className="text-dark-400 mb-8">Instant online booking. Confirmed in seconds.</p>
            <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold">
              Book Your Vehicle
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
